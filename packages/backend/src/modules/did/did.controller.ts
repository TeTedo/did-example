import { Controller, Get, Param, Query } from '@nestjs/common';
import { DidService, DidDocument } from './did.service';

@Controller('api/did')
export class DidController {
  constructor(private readonly didService: DidService) {}

  /**
   * Resolve a DID to its DID Document
   * @param did - The DID to resolve (e.g., did:ethr:0x1234...)
   * @param timestamp - Optional ISO timestamp to resolve at a specific point in time
   * @param block - Optional block number to resolve at a specific block
   */
  @Get(':did')
  async getDidDocument(
    @Param('did') did: string,
    @Query('timestamp') timestamp?: string,
    @Query('block') block?: string,
  ): Promise<DidDocument> {
    // Time-based resolution
    if (timestamp) {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid timestamp format. Use ISO 8601 format.');
      }
      return this.didService.resolveAtTime(did, date);
    }

    // Block-based resolution
    if (block) {
      const blockNumber = parseInt(block, 10);
      if (isNaN(blockNumber)) {
        throw new Error('Invalid block number.');
      }
      return this.didService.resolveAtBlock(did, blockNumber);
    }

    // Current state resolution
    return this.didService.resolve(did);
  }

  /**
   * Get the current owner of a DID
   */
  @Get(':did/owner')
  async getOwner(
    @Param('did') did: string,
    @Query('timestamp') timestamp?: string,
  ) {
    if (timestamp) {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid timestamp format. Use ISO 8601 format.');
      }
      const owner = await this.didService.getOwnerAtTime(did, date);
      return {
        did: `did:ethr:${this.extractAddress(did)}`,
        owner,
        queryTimestamp: timestamp,
      };
    }
    return this.didService.getOwner(did);
  }

  @Get(':did/delegates')
  async getDelegates(@Param('did') did: string) {
    return this.didService.getDelegates(did);
  }

  @Get(':did/attributes')
  async getAttributes(@Param('did') did: string) {
    return this.didService.getAttributes(did);
  }

  /**
   * Check if an address was a valid signer at a specific time
   */
  @Get(':did/verify-signer')
  async verifySigner(
    @Param('did') did: string,
    @Query('signer') signer: string,
    @Query('timestamp') timestamp: string,
  ) {
    if (!signer) {
      throw new Error('Signer address is required.');
    }
    if (!timestamp) {
      throw new Error('Timestamp is required.');
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid timestamp format. Use ISO 8601 format.');
    }

    const wasValid = await this.didService.wasValidSignerAtTime(
      did,
      signer,
      date,
    );
    const ownerAtTime = await this.didService.getOwnerAtTime(did, date);

    return {
      did,
      signer,
      timestamp,
      wasValidSigner: wasValid,
      ownerAtTime,
    };
  }

  private extractAddress(did: string): string {
    const parts = did.split(':');
    return parts.length > 1 ? parts[parts.length - 1] : did;
  }
}
