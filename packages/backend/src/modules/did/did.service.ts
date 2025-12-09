import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ethers } from 'ethers';
import { Identity } from '../../entities/Identity';
import { Delegate } from '../../entities/Delegate';
import { Attribute } from '../../entities/Attribute';
import { Event } from '../../entities/Event';

// Event args interfaces
interface OwnerChangedArgs {
  identity: string;
  owner: string;
  previousChange: string;
}

interface DelegateChangedArgs {
  identity: string;
  delegateType: string;
  delegate: string;
  validTo: string;
  previousChange: string;
}

interface AttributeChangedArgs {
  identity: string;
  name: string;
  value: string;
  validTo: string;
  previousChange: string;
}

// W3C DID Core 1.0 compliant contexts
const DID_CONTEXTS = [
  'https://www.w3.org/ns/did/v1',
  'https://w3id.org/security/suites/secp256k1recovery-2020/v2',
  'https://w3id.org/security/suites/secp256k1-2019/v1',
];

// W3C DID Document interface
export interface DidDocument {
  '@context': string[];
  id: string;
  controller?: string;
  verificationMethod: VerificationMethod[];
  authentication: (string | VerificationMethod)[];
  assertionMethod: (string | VerificationMethod)[];
  keyAgreement?: (string | VerificationMethod)[];
  capabilityInvocation?: (string | VerificationMethod)[];
  capabilityDelegation?: (string | VerificationMethod)[];
  service?: ServiceEndpoint[];
}

interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  blockchainAccountId?: string;
  publicKeyBase64?: string;
  publicKeyHex?: string;
  publicKeyJwk?: object;
}

interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string | string[] | object;
}

@Injectable()
export class DidService {
  private readonly logger = new Logger(DidService.name);
  private provider: ethers.JsonRpcProvider;

  constructor(
    @InjectRepository(Identity)
    private identityRepository: Repository<Identity>,
    @InjectRepository(Delegate)
    private delegateRepository: Repository<Delegate>,
    @InjectRepository(Attribute)
    private attributeRepository: Repository<Attribute>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private configService: ConfigService,
  ) {
    const rpcUrl = this.configService.get<string>(
      'RPC_URL',
      'http://127.0.0.1:8545',
    );
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  private extractAddress(did: string): string {
    // Handle both "did:ethr:0x..." and plain address "0x..."
    const parts = did.split(':');
    const address = parts.length > 1 ? parts[parts.length - 1] : did;
    return address.toLowerCase();
  }

  /**
   * Resolve a DID to its DID Document (W3C DID Core 1.0 compliant)
   */
  async resolve(did: string): Promise<DidDocument> {
    const address = this.extractAddress(did);

    const identity = await this.identityRepository.findOne({
      where: { address },
      relations: ['delegates', 'attributes'],
    });

    if (!identity) {
      // Return a basic document for addresses not yet in the database
      return this.buildDidDocument(address, null, [], []);
    }

    return this.buildDidDocument(
      address,
      identity.controller,
      identity.delegates || [],
      identity.attributes || [],
    );
  }

  async getOwner(did: string) {
    const address = this.extractAddress(did);

    const identity = await this.identityRepository.findOne({
      where: { address },
    });

    return {
      did: `did:ethr:${address}`,
      owner: identity?.controller || address,
      isSelfOwned: !identity?.controller || identity.controller === address,
    };
  }

  async getDelegates(did: string) {
    const address = this.extractAddress(did);

    const identity = await this.identityRepository.findOne({
      where: { address },
      relations: ['delegates'],
    });

    const delegates = identity?.delegates || [];
    const now = Math.floor(Date.now() / 1000);

    return {
      did: `did:ethr:${address}`,
      delegates: delegates.map((d) => ({
        id: d.id,
        type: d.delegateType,
        address: d.delegateAddress,
        validTo: d.validTo,
        isValid: d.validTo > now,
        createdAt: d.createdAt,
      })),
    };
  }

  async getAttributes(did: string) {
    const address = this.extractAddress(did);

    const identity = await this.identityRepository.findOne({
      where: { address },
      relations: ['attributes'],
    });

    const attributes = identity?.attributes || [];
    const now = Math.floor(Date.now() / 1000);

    return {
      did: `did:ethr:${address}`,
      attributes: attributes.map((a) => ({
        id: a.id,
        name: a.name,
        value: a.value,
        validTo: a.validTo,
        isValid: a.validTo > now,
        createdAt: a.createdAt,
      })),
    };
  }

  /**
   * Build a W3C DID Core 1.0 compliant DID Document
   */
  private buildDidDocument(
    address: string,
    controller: string | null,
    delegates: Delegate[],
    attributes: Attribute[],
  ): DidDocument {
    const did = `did:ethr:${address}`;
    const now = Math.floor(Date.now() / 1000);

    // Filter out expired delegates and attributes
    const validDelegates = delegates.filter((d) => d.validTo > now);
    const validAttributes = attributes.filter((a) => a.validTo > now);

    // Primary verification method (controller key)
    const verificationMethod: VerificationMethod[] = [
      {
        id: `${did}#controller`,
        type: 'EcdsaSecp256k1RecoveryMethod2020',
        controller: controller ? `did:ethr:${controller}` : did,
        blockchainAccountId: `eip155:1:${address}`,
      },
    ];

    const authentication: string[] = [`${did}#controller`];
    const assertionMethod: string[] = [`${did}#controller`];

    // Add delegates as verification methods
    validDelegates.forEach((delegate, index) => {
      const delegateId = `${did}#delegate-${index}`;
      verificationMethod.push({
        id: delegateId,
        type: 'EcdsaSecp256k1RecoveryMethod2020',
        controller: did,
        blockchainAccountId: `eip155:1:${delegate.delegateAddress}`,
      });

      // sigAuth delegates go to authentication
      if (delegate.delegateType === 'sigAuth') {
        authentication.push(delegateId);
      }
      // veriKey delegates go to assertionMethod
      if (delegate.delegateType === 'veriKey') {
        assertionMethod.push(delegateId);
      }
    });

    // Parse service endpoints from attributes
    const service: ServiceEndpoint[] = validAttributes
      .filter((attr) => attr.name.startsWith('did/svc/'))
      .map((attr, index) => ({
        id: `${did}#service-${index}`,
        type: attr.name.replace('did/svc/', ''),
        serviceEndpoint: attr.value,
      }));

    // Add public keys from attributes
    validAttributes
      .filter((attr) => attr.name.startsWith('did/pub/'))
      .forEach((attr, index) => {
        const parts = attr.name.split('/');
        const algorithm = parts[2] || 'Unknown';
        const keyType = parts[3] || 'veriKey';
        const encoding = parts[4] || 'base64';

        const keyId = `${did}#key-${index}`;

        const keyMethod: VerificationMethod = {
          id: keyId,
          type: `${algorithm}VerificationKey2020`,
          controller: did,
        };

        // Set the appropriate key format
        if (encoding === 'base64') {
          keyMethod.publicKeyBase64 = attr.value;
        } else if (encoding === 'hex') {
          keyMethod.publicKeyHex = attr.value;
        }

        verificationMethod.push(keyMethod);

        // Add to appropriate verification relationship
        if (keyType === 'veriKey') {
          assertionMethod.push(keyId);
        }
        if (keyType === 'sigAuth') {
          authentication.push(keyId);
        }
        if (keyType === 'enc') {
          // Key agreement keys would go here
        }
      });

    // Build the DID Document
    const didDocument: DidDocument = {
      '@context': DID_CONTEXTS,
      id: did,
      verificationMethod,
      authentication,
      assertionMethod,
    };

    // Add controller if different from self
    if (controller && controller.toLowerCase() !== address.toLowerCase()) {
      didDocument.controller = `did:ethr:${controller}`;
    }

    // Add service if present
    if (service.length > 0) {
      didDocument.service = service;
    }

    return didDocument;
  }

  // ===================================================================
  // Time-based Resolution Methods (for historical state verification)
  // ===================================================================

  /**
   * Get the block number closest to a given timestamp
   */
  async getBlockByTimestamp(timestamp: Date): Promise<number> {
    const targetTime = Math.floor(timestamp.getTime() / 1000);
    const latestBlock = await this.provider.getBlock('latest');

    if (!latestBlock) {
      throw new Error('Could not fetch latest block');
    }

    // Binary search to find the closest block
    let low = 0;
    let high = latestBlock.number;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const block = await this.provider.getBlock(mid);

      if (!block) {
        high = mid;
        continue;
      }

      if (block.timestamp < targetTime) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  /**
   * Resolve a DID to its DID Document at a specific block number
   * This reconstructs the historical state by traversing event history
   */
  async resolveAtBlock(did: string, blockNumber: number): Promise<DidDocument> {
    const address = this.extractAddress(did);
    this.logger.log(
      `Resolving DID ${did} at block ${blockNumber} (historical)`,
    );

    // Get all events for this identity up to the target block
    const events = await this.eventRepository.find({
      where: {
        blockNumber: LessThanOrEqual(blockNumber),
      },
      order: { blockNumber: 'ASC', id: 'ASC' },
    });

    // Filter events for this identity
    const identityEvents = events.filter((e) => {
      const args = e.args as
        | OwnerChangedArgs
        | DelegateChangedArgs
        | AttributeChangedArgs;
      return args.identity?.toLowerCase() === address.toLowerCase();
    });

    // Reconstruct state at that block
    const historicalState = this.reconstructStateFromEvents(
      address,
      identityEvents,
      blockNumber,
    );

    return this.buildDidDocument(
      address,
      historicalState.owner,
      historicalState.delegates,
      historicalState.attributes,
    );
  }

  /**
   * Resolve a DID to its DID Document at a specific timestamp
   */
  async resolveAtTime(did: string, timestamp: Date): Promise<DidDocument> {
    const blockNumber = await this.getBlockByTimestamp(timestamp);
    this.logger.log(
      `Timestamp ${timestamp.toISOString()} corresponds to block ~${blockNumber}`,
    );
    return this.resolveAtBlock(did, blockNumber);
  }

  /**
   * Get the owner of a DID at a specific block number
   */
  async getOwnerAtBlock(did: string, blockNumber: number): Promise<string> {
    const address = this.extractAddress(did);

    // Get all owner changed events up to the target block
    const ownerEvents = await this.eventRepository.find({
      where: {
        eventName: 'DIDOwnerChanged',
        blockNumber: LessThanOrEqual(blockNumber),
      },
      order: { blockNumber: 'DESC', id: 'DESC' },
    });

    // Find the most recent owner change for this identity
    for (const event of ownerEvents) {
      const args = event.args as OwnerChangedArgs;
      if (args.identity?.toLowerCase() === address.toLowerCase()) {
        return args.owner.toLowerCase();
      }
    }

    // If no owner change found, the identity owns itself
    return address.toLowerCase();
  }

  /**
   * Get the owner of a DID at a specific timestamp
   */
  async getOwnerAtTime(did: string, timestamp: Date): Promise<string> {
    const blockNumber = await this.getBlockByTimestamp(timestamp);
    return this.getOwnerAtBlock(did, blockNumber);
  }

  /**
   * Check if an address was a valid signer for a DID at a specific block
   * (either owner or valid delegate)
   */
  async wasValidSignerAtBlock(
    did: string,
    signerAddress: string,
    blockNumber: number,
  ): Promise<boolean> {
    const address = this.extractAddress(did);
    const signer = signerAddress.toLowerCase();

    // Check if signer was the owner
    const ownerAtBlock = await this.getOwnerAtBlock(did, blockNumber);
    if (ownerAtBlock === signer) {
      return true;
    }

    // Check if signer was a valid delegate
    const events = await this.eventRepository.find({
      where: {
        eventName: 'DIDDelegateChanged',
        blockNumber: LessThanOrEqual(blockNumber),
      },
      order: { blockNumber: 'ASC', id: 'ASC' },
    });

    // Reconstruct delegate state at that block
    const delegateState = new Map<string, number>(); // delegate -> validTo

    for (const event of events) {
      const args = event.args as DelegateChangedArgs;
      if (args.identity?.toLowerCase() !== address.toLowerCase()) continue;

      const delegateKey = `${args.delegateType}:${args.delegate.toLowerCase()}`;
      delegateState.set(delegateKey, parseInt(args.validTo));
    }

    // Check if signer was a valid delegate at the block time
    const block = await this.provider.getBlock(blockNumber);
    if (!block) return false;

    const blockTimestamp = block.timestamp;

    for (const [key, validTo] of delegateState) {
      const [, delegateAddr] = key.split(':');
      if (delegateAddr === signer && validTo > blockTimestamp) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an address was a valid signer for a DID at a specific timestamp
   */
  async wasValidSignerAtTime(
    did: string,
    signerAddress: string,
    timestamp: Date,
  ): Promise<boolean> {
    const blockNumber = await this.getBlockByTimestamp(timestamp);
    return this.wasValidSignerAtBlock(did, signerAddress, blockNumber);
  }

  /**
   * Reconstruct the DID state from events up to a specific block
   */
  private reconstructStateFromEvents(
    address: string,
    events: Event[],
    maxBlock: number,
  ): {
    owner: string | null;
    delegates: Delegate[];
    attributes: Attribute[];
  } {
    let owner: string | null = null;
    const delegatesMap = new Map<
      string,
      { delegateType: string; delegateAddress: string; validTo: number }
    >();
    const attributesMap = new Map<
      string,
      { name: string; value: string; validTo: number }
    >();

    for (const event of events) {
      if (event.blockNumber > maxBlock) break;

      switch (event.eventName) {
        case 'DIDOwnerChanged': {
          const args = event.args as OwnerChangedArgs;
          owner = args.owner.toLowerCase();
          break;
        }
        case 'DIDDelegateChanged': {
          const args = event.args as DelegateChangedArgs;
          const key = `${args.delegateType}:${args.delegate.toLowerCase()}`;
          delegatesMap.set(key, {
            delegateType: args.delegateType,
            delegateAddress: args.delegate.toLowerCase(),
            validTo: parseInt(args.validTo),
          });
          break;
        }
        case 'DIDAttributeChanged': {
          const args = event.args as AttributeChangedArgs;
          attributesMap.set(args.name, {
            name: args.name,
            value: args.value,
            validTo: parseInt(args.validTo),
          });
          break;
        }
      }
    }

    // Convert maps to arrays with Delegate/Attribute-like structure
    const delegates = Array.from(delegatesMap.values()).map((d) => ({
      delegateType: d.delegateType,
      delegateAddress: d.delegateAddress,
      validTo: d.validTo,
    })) as unknown as Delegate[];

    const attributes = Array.from(attributesMap.values()).map((a) => ({
      name: a.name,
      value: a.value,
      validTo: a.validTo,
    })) as unknown as Attribute[];

    return { owner, delegates, attributes };
  }
}
