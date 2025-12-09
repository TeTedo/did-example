import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { CredentialService, IssueCredentialDto } from './credential.service';

@Controller('api/credentials')
export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  /**
   * Issue a new Verifiable Credential
   * POST /api/credentials/issue
   */
  @Post('issue')
  async issue(@Body() dto: IssueCredentialDto) {
    return this.credentialService.issue(dto);
  }

  /**
   * Verify a Verifiable Credential
   * GET /api/credentials/:id/verify
   */
  @Get(':id/verify')
  async verify(@Param('id') id: string) {
    return this.credentialService.verify(id);
  }

  /**
   * Get credential status (W3C CredentialStatusList2021)
   * GET /api/credentials/:id/status
   */
  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    return this.credentialService.getStatus(id);
  }

  /**
   * Get a credential by ID
   * GET /api/credentials/:id
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.credentialService.findById(id);
  }

  /**
   * Get all credentials issued by a DID or owned by a DID
   * GET /api/credentials?issuer=did:ethr:0x...
   * GET /api/credentials?subject=did:ethr:0x...
   */
  @Get()
  async find(
    @Query('issuer') issuer?: string,
    @Query('subject') subject?: string,
  ) {
    if (issuer) {
      return this.credentialService.findByIssuer(issuer);
    }
    if (subject) {
      return this.credentialService.findBySubject(subject);
    }
    return { error: 'Please provide issuer or subject query parameter' };
  }

  /**
   * Revoke a credential
   * POST /api/credentials/:id/revoke
   */
  @Post(':id/revoke')
  async revoke(
    @Param('id') id: string,
    @Body() body: { issuerAddress: string; signature: string },
  ) {
    return this.credentialService.revoke(
      id,
      body.issuerAddress,
      body.signature,
    );
  }
}
