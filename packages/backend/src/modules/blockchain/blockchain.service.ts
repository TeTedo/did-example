import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers, Log, EventLog, ContractEventPayload } from 'ethers';
import { Event } from '../../entities/Event';
import { Identity } from '../../entities/Identity';
import { Delegate } from '../../entities/Delegate';
import { Attribute } from '../../entities/Attribute';
import { EventGateway } from '../event/event.gateway';

// EthereumDIDRegistry ABI (events only)
const DID_REGISTRY_ABI = [
  'event DIDOwnerChanged(address indexed identity, address owner, uint256 previousChange)',
  'event DIDDelegateChanged(address indexed identity, bytes32 delegateType, address delegate, uint256 validTo, uint256 previousChange)',
  'event DIDAttributeChanged(address indexed identity, bytes32 name, bytes value, uint256 validTo, uint256 previousChange)',
];

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private isListening = false;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(Identity)
    private identityRepository: Repository<Identity>,
    @InjectRepository(Delegate)
    private delegateRepository: Repository<Delegate>,
    @InjectRepository(Attribute)
    private attributeRepository: Repository<Attribute>,
    private eventGateway: EventGateway,
  ) {}

  async onModuleInit() {
    this.initializeProvider();
    await this.startListening();
  }

  private initializeProvider() {
    const rpcUrl = this.configService.get<string>(
      'RPC_URL',
      'http://127.0.0.1:8545',
    );
    const contractAddress = this.configService.get<string>(
      'CONTRACT_ADDRESS',
      '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    );

    this.logger.log(`Connecting to RPC: ${rpcUrl}`);
    this.logger.log(`Contract address: ${contractAddress}`);

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = new ethers.Contract(
      contractAddress,
      DID_REGISTRY_ABI,
      this.provider,
    );
  }

  async startListening() {
    if (this.isListening) return;

    try {
      // Test connection
      const blockNumber = await this.provider.getBlockNumber();
      this.logger.log(`Connected to blockchain at block ${blockNumber}`);

      // Listen to DIDOwnerChanged events
      void this.contract.on(
        'DIDOwnerChanged',
        (
          identity: string,
          owner: string,
          previousChange: bigint,
          event: ContractEventPayload,
        ) => {
          void this.handleOwnerChanged(
            identity,
            owner,
            previousChange,
            event.log,
          );
        },
      );

      // Listen to DIDDelegateChanged events
      void this.contract.on(
        'DIDDelegateChanged',
        (
          identity: string,
          delegateType: string,
          delegate: string,
          validTo: bigint,
          previousChange: bigint,
          event: ContractEventPayload,
        ) => {
          void this.handleDelegateChanged(
            identity,
            delegateType,
            delegate,
            validTo,
            previousChange,
            event.log,
          );
        },
      );

      // Listen to DIDAttributeChanged events
      void this.contract.on(
        'DIDAttributeChanged',
        (
          identity: string,
          name: string,
          value: string,
          validTo: bigint,
          previousChange: bigint,
          event: ContractEventPayload,
        ) => {
          void this.handleAttributeChanged(
            identity,
            name,
            value,
            validTo,
            previousChange,
            event.log,
          );
        },
      );

      this.isListening = true;
      this.logger.log('Started listening to DID Registry events');
    } catch (error) {
      this.logger.error('Failed to start event listener:', error);
    }
  }

  private async handleOwnerChanged(
    identity: string,
    owner: string,
    previousChange: bigint,
    log: EventLog | Log,
  ) {
    this.logger.log(`DIDOwnerChanged: ${identity} -> ${owner}`);

    try {
      // Save event to database
      await this.eventRepository.save({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        eventName: 'DIDOwnerChanged',
        args: {
          identity,
          owner,
          previousChange: previousChange.toString(),
        },
      });

      // Update or create identity
      let identityEntity = await this.identityRepository.findOne({
        where: { address: identity.toLowerCase() },
      });

      if (!identityEntity) {
        identityEntity = this.identityRepository.create({
          address: identity.toLowerCase(),
        });
      }

      identityEntity.controller = owner.toLowerCase();
      await this.identityRepository.save(identityEntity);

      // Broadcast to WebSocket clients
      this.eventGateway.broadcastEvent({
        type: 'OwnerChanged',
        identity,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: Date.now(),
        data: {
          owner,
          previousChange: Number(previousChange),
        },
      });
    } catch (error) {
      this.logger.error('Error handling DIDOwnerChanged:', error);
    }
  }

  private async handleDelegateChanged(
    identity: string,
    delegateType: string,
    delegate: string,
    validTo: bigint,
    previousChange: bigint,
    log: EventLog | Log,
  ) {
    let delegateTypeStr: string;
    try {
      delegateTypeStr = ethers.decodeBytes32String(delegateType);
    } catch {
      delegateTypeStr = delegateType;
    }
    this.logger.log(
      `DIDDelegateChanged: ${identity} - ${delegateTypeStr} - ${delegate}`,
    );

    try {
      // Save event to database
      await this.eventRepository.save({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        eventName: 'DIDDelegateChanged',
        args: {
          identity,
          delegateType: delegateTypeStr,
          delegate,
          validTo: validTo.toString(),
          previousChange: previousChange.toString(),
        },
      });

      // Update or create identity
      let identityEntity = await this.identityRepository.findOne({
        where: { address: identity.toLowerCase() },
      });

      if (!identityEntity) {
        identityEntity = await this.identityRepository.save({
          address: identity.toLowerCase(),
        });
      }

      // Find existing delegate or create new one
      const delegateEntity = await this.delegateRepository.findOne({
        where: {
          identity: { address: identity.toLowerCase() },
          delegateType: delegateTypeStr,
          delegateAddress: delegate.toLowerCase(),
        },
      });

      if (delegateEntity) {
        delegateEntity.validTo = Number(validTo);
        await this.delegateRepository.save(delegateEntity);
      } else {
        await this.delegateRepository.save({
          identity: identityEntity,
          delegateType: delegateTypeStr,
          delegateAddress: delegate.toLowerCase(),
          validTo: Number(validTo),
        });
      }

      // Broadcast to WebSocket clients
      this.eventGateway.broadcastEvent({
        type: 'DelegateChanged',
        identity,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: Date.now(),
        data: {
          delegateType: delegateTypeStr,
          delegate,
          validTo: Number(validTo),
          previousChange: Number(previousChange),
        },
      });
    } catch (error) {
      this.logger.error('Error handling DIDDelegateChanged:', error);
    }
  }

  private async handleAttributeChanged(
    identity: string,
    name: string,
    value: string,
    validTo: bigint,
    previousChange: bigint,
    log: EventLog | Log,
  ) {
    let nameStr: string;
    try {
      nameStr = ethers.decodeBytes32String(name);
    } catch {
      nameStr = name;
    }

    this.logger.log(`DIDAttributeChanged: ${identity} - ${nameStr}`);

    try {
      // Save event to database
      await this.eventRepository.save({
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        eventName: 'DIDAttributeChanged',
        args: {
          identity,
          name: nameStr,
          value: ethers.hexlify(value),
          validTo: validTo.toString(),
          previousChange: previousChange.toString(),
        },
      });

      // Update or create identity
      let identityEntity = await this.identityRepository.findOne({
        where: { address: identity.toLowerCase() },
      });

      if (!identityEntity) {
        identityEntity = await this.identityRepository.save({
          address: identity.toLowerCase(),
        });
      }

      // Decode value to string if possible
      let valueStr: string;
      try {
        valueStr = ethers.toUtf8String(value);
      } catch {
        valueStr = ethers.hexlify(value);
      }

      // Find existing attribute or create new one
      const attributeEntity = await this.attributeRepository.findOne({
        where: {
          identity: { address: identity.toLowerCase() },
          name: nameStr,
        },
      });

      if (attributeEntity) {
        attributeEntity.value = valueStr;
        attributeEntity.validTo = Number(validTo);
        await this.attributeRepository.save(attributeEntity);
      } else {
        await this.attributeRepository.save({
          identity: identityEntity,
          name: nameStr,
          value: valueStr,
          validTo: Number(validTo),
        });
      }

      // Broadcast to WebSocket clients
      this.eventGateway.broadcastEvent({
        type: 'AttributeChanged',
        identity,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        timestamp: Date.now(),
        data: {
          name: nameStr,
          value: valueStr,
          validTo: Number(validTo),
          previousChange: Number(previousChange),
        },
      });
    } catch (error) {
      this.logger.error('Error handling DIDAttributeChanged:', error);
    }
  }

  stopListening() {
    if (!this.isListening) return;

    void this.contract.removeAllListeners();
    this.isListening = false;
    this.logger.log('Stopped listening to DID Registry events');
  }

  // Sync past events from a specific block
  async syncFromBlock(fromBlock: number) {
    this.logger.log(`Syncing events from block ${fromBlock}`);

    try {
      const latestBlock = await this.provider.getBlockNumber();

      // Query past events
      const ownerChangedFilter = this.contract.filters.DIDOwnerChanged();
      const delegateChangedFilter = this.contract.filters.DIDDelegateChanged();
      const attributeChangedFilter =
        this.contract.filters.DIDAttributeChanged();

      const [ownerEvents, delegateEvents, attributeEvents] = await Promise.all([
        this.contract.queryFilter(ownerChangedFilter, fromBlock, latestBlock),
        this.contract.queryFilter(
          delegateChangedFilter,
          fromBlock,
          latestBlock,
        ),
        this.contract.queryFilter(
          attributeChangedFilter,
          fromBlock,
          latestBlock,
        ),
      ]);

      this.logger.log(
        `Found ${ownerEvents.length} owner, ${delegateEvents.length} delegate, ${attributeEvents.length} attribute events`,
      );

      // Process each event
      for (const event of ownerEvents) {
        if (this.isEventLog(event)) {
          const args = event.args as unknown as [string, string, bigint];
          await this.handleOwnerChanged(args[0], args[1], args[2], event);
        }
      }

      for (const event of delegateEvents) {
        if (this.isEventLog(event)) {
          const args = event.args as unknown as [
            string,
            string,
            string,
            bigint,
            bigint,
          ];
          await this.handleDelegateChanged(
            args[0],
            args[1],
            args[2],
            args[3],
            args[4],
            event,
          );
        }
      }

      for (const event of attributeEvents) {
        if (this.isEventLog(event)) {
          const args = event.args as unknown as [
            string,
            string,
            string,
            bigint,
            bigint,
          ];
          await this.handleAttributeChanged(
            args[0],
            args[1],
            args[2],
            args[3],
            args[4],
            event,
          );
        }
      }

      this.logger.log('Sync completed');
    } catch (error) {
      this.logger.error('Error syncing events:', error);
    }
  }

  private isEventLog(event: Log | EventLog): event is EventLog {
    return 'args' in event;
  }
}
