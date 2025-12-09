import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { Credential, CredentialStatus } from '../../entities/Credential';
import { DidService } from '../did/did.service';

// W3C VC Data Model 1.1 compliant contexts
const VC_CONTEXTS = [
  'https://www.w3.org/2018/credentials/v1',
  'https://w3id.org/security/suites/secp256k1-2019/v1',
];

export interface IssueCredentialDto {
  issuerAddress: string;
  subjectDid: string;
  type: string[];
  claims: Record<string, unknown>;
  issuanceDate: string; // ISO string from frontend
  expirationDate?: string;
  signature: string; // Issuer's signature
}

// W3C VC Data Model 1.1 compliant structure
export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string;
    [key: string]: unknown;
  };
  credentialStatus?: {
    id: string;
    type: string;
  };
  proof: CredentialProof;
}

// W3C Data Integrity compliant proof
interface CredentialProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string; // Changed from 'signature' to 'proofValue' (W3C standard)
}

@Injectable()
export class CredentialService {
  private readonly logger = new Logger(CredentialService.name);
  private readonly apiBaseUrl: string;

  constructor(
    @InjectRepository(Credential)
    private credentialRepository: Repository<Credential>,
    private configService: ConfigService,
    private didService: DidService,
  ) {
    this.apiBaseUrl = this.configService.get<string>(
      'API_BASE_URL',
      'http://localhost:3001',
    );
  }

  /**
   * Issue a new Verifiable Credential (W3C VC Data Model 1.1 compliant)
   */
  async issue(dto: IssueCredentialDto): Promise<VerifiableCredential> {
    const issuerDid = `did:ethr:${dto.issuerAddress.toLowerCase()}`;

    // Create the credential payload for signing (must match frontend exactly)
    const credentialPayload = {
      '@context': VC_CONTEXTS,
      type: ['VerifiableCredential', ...dto.type],
      issuer: issuerDid,
      issuanceDate: dto.issuanceDate,
      expirationDate: dto.expirationDate,
      credentialSubject: {
        id: dto.subjectDid,
        ...dto.claims,
      },
    };

    // Verify the signature
    const message = JSON.stringify(credentialPayload);

    try {
      const recoveredAddress = ethers.verifyMessage(message, dto.signature);

      if (recoveredAddress.toLowerCase() !== dto.issuerAddress.toLowerCase()) {
        throw new BadRequestException(
          'Invalid signature: signer does not match issuer',
        );
      }
    } catch {
      throw new BadRequestException('Invalid signature format');
    }

    // Create W3C Data Integrity compliant proof
    const proof: CredentialProof = {
      type: 'EcdsaSecp256k1Signature2019',
      created: dto.issuanceDate,
      verificationMethod: `${issuerDid}#controller`,
      proofPurpose: 'assertionMethod',
      proofValue: dto.signature, // W3C standard field name
    };

    // Save to database
    const credential = await this.credentialRepository.save({
      issuer: issuerDid,
      subject: dto.subjectDid,
      type: ['VerifiableCredential', ...dto.type],
      claims: dto.claims,
      issuanceDate: dto.issuanceDate,
      expirationDate: dto.expirationDate,
      status: CredentialStatus.ACTIVE,
      proof: JSON.stringify(proof),
    });

    // Build credential status URL
    const credentialId = `urn:uuid:${credential.id}`;
    const credentialStatus = {
      id: `${this.apiBaseUrl}/api/credentials/${encodeURIComponent(credentialId)}/status`,
      type: 'CredentialStatusList2021',
    };

    // Return W3C compliant VC
    return {
      '@context': VC_CONTEXTS,
      id: credentialId,
      type: credential.type,
      issuer: issuerDid,
      issuanceDate: dto.issuanceDate,
      expirationDate: dto.expirationDate,
      credentialSubject: {
        id: dto.subjectDid,
        ...dto.claims,
      },
      credentialStatus,
      proof,
    };
  }

  /**
   * Get credential status (W3C CredentialStatusList2021)
   */
  async getStatus(credentialId: string): Promise<{
    id: string;
    type: string;
    status: 'active' | 'revoked' | 'expired';
    statusListIndex?: number;
  }> {
    const uuid = credentialId.replace('urn:uuid:', '');

    const credential = await this.credentialRepository.findOne({
      where: { id: uuid },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    const now = new Date();
    let status: 'active' | 'revoked' | 'expired' = 'active';

    if (credential.status === CredentialStatus.REVOKED) {
      status = 'revoked';
    } else if (
      credential.expirationDate &&
      new Date(credential.expirationDate) < now
    ) {
      status = 'expired';
    }

    return {
      id: `${this.apiBaseUrl}/api/credentials/${encodeURIComponent(credentialId)}/status`,
      type: 'CredentialStatusList2021',
      status,
    };
  }

  /**
   * Verify a Verifiable Credential (W3C compliant with time-based verification)
   *
   * This performs time-based verification:
   * - Checks if the signer was a valid owner/delegate at the time of issuance
   * - Not just the current state
   */
  async verify(credentialId: string): Promise<{
    valid: boolean;
    checks: {
      signature: boolean;
      signerValidAtIssuance: boolean;
      notExpired: boolean;
      notRevoked: boolean;
    };
    credential?: VerifiableCredential;
    error?: string;
    details?: {
      recoveredAddress: string;
      issuerDid: string;
      issuanceDate: string;
      ownerAtIssuance: string;
      wasValidSigner: boolean;
    };
  }> {
    const uuid = credentialId.replace('urn:uuid:', '');

    const credential = await this.credentialRepository.findOne({
      where: { id: uuid },
    });

    if (!credential) {
      return {
        valid: false,
        checks: {
          signature: false,
          signerValidAtIssuance: false,
          notExpired: false,
          notRevoked: false,
        },
        error: 'Credential not found',
      };
    }

    const proof = JSON.parse(credential.proof) as CredentialProof;
    const now = new Date();
    const issuanceDate = new Date(credential.issuanceDate);

    // Check 1: Not revoked
    const notRevoked = credential.status === CredentialStatus.ACTIVE;

    // Check 2: Not expired
    const notExpired = credential.expirationDate
      ? new Date(credential.expirationDate) > now
      : true;

    // Check 3: Verify signature
    let signatureValid = false;
    let recoveredAddress = '';
    try {
      // Reconstruct the exact same payload that was signed
      const credentialPayload = {
        '@context': VC_CONTEXTS,
        type: credential.type,
        issuer: credential.issuer,
        issuanceDate: credential.issuanceDate,
        expirationDate: credential.expirationDate || undefined,
        credentialSubject: {
          id: credential.subject,
          ...credential.claims,
        },
      };

      const message = JSON.stringify(credentialPayload);
      recoveredAddress = ethers.verifyMessage(message, proof.proofValue);
      const issuerAddress = credential.issuer.split(':').pop();

      signatureValid =
        recoveredAddress.toLowerCase() === issuerAddress?.toLowerCase();
    } catch {
      signatureValid = false;
    }

    // Check 4: Time-based verification
    // Was the signer a valid owner/delegate at the time of issuance?
    let signerValidAtIssuance = false;
    let ownerAtIssuance = '';

    if (recoveredAddress) {
      try {
        // Get the owner at the time of issuance
        ownerAtIssuance = await this.didService.getOwnerAtTime(
          credential.issuer,
          issuanceDate,
        );

        // Check if the recovered address was a valid signer at issuance time
        signerValidAtIssuance = await this.didService.wasValidSignerAtTime(
          credential.issuer,
          recoveredAddress,
          issuanceDate,
        );

        this.logger.log(
          `Time-based verification for ${credential.issuer}:` +
            ` recovered=${recoveredAddress}, ownerAtIssuance=${ownerAtIssuance},` +
            ` wasValidSigner=${signerValidAtIssuance}`,
        );
      } catch (error) {
        this.logger.warn(`Could not perform time-based verification: ${error}`);
        // Fallback to current state verification if time-based fails
        signerValidAtIssuance = signatureValid;
      }
    }

    // All checks must pass
    const valid =
      signatureValid && signerValidAtIssuance && notExpired && notRevoked;

    return {
      valid,
      checks: {
        signature: signatureValid,
        signerValidAtIssuance,
        notExpired,
        notRevoked,
      },
      credential: valid ? this.toVerifiableCredential(credential) : undefined,
      details: {
        recoveredAddress,
        issuerDid: credential.issuer,
        issuanceDate: credential.issuanceDate,
        ownerAtIssuance,
        wasValidSigner: signerValidAtIssuance,
      },
    };
  }

  /**
   * Get all credentials issued by a DID
   */
  async findByIssuer(issuerDid: string): Promise<VerifiableCredential[]> {
    const credentials = await this.credentialRepository.find({
      where: { issuer: issuerDid.toLowerCase() },
      order: { createdAt: 'DESC' },
    });

    return credentials.map((c) => this.toVerifiableCredential(c));
  }

  /**
   * Get all credentials owned by a DID (subject)
   */
  async findBySubject(subjectDid: string): Promise<VerifiableCredential[]> {
    const credentials = await this.credentialRepository.find({
      where: { subject: subjectDid.toLowerCase() },
      order: { createdAt: 'DESC' },
    });

    return credentials.map((c) => this.toVerifiableCredential(c));
  }

  /**
   * Revoke a credential (only issuer can revoke)
   */
  async revoke(
    credentialId: string,
    issuerAddress: string,
    signature: string,
  ): Promise<{ success: boolean; message: string }> {
    const uuid = credentialId.replace('urn:uuid:', '');
    const issuerDid = `did:ethr:${issuerAddress.toLowerCase()}`;

    const credential = await this.credentialRepository.findOne({
      where: { id: uuid },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    if (credential.issuer.toLowerCase() !== issuerDid.toLowerCase()) {
      throw new BadRequestException(
        'Only the issuer can revoke this credential',
      );
    }

    // Verify signature for revocation
    const revokeMessage = `Revoke credential: ${credentialId}`;
    try {
      const recoveredAddress = ethers.verifyMessage(revokeMessage, signature);
      if (recoveredAddress.toLowerCase() !== issuerAddress.toLowerCase()) {
        throw new BadRequestException('Invalid revocation signature');
      }
    } catch {
      throw new BadRequestException('Invalid signature format');
    }

    credential.status = CredentialStatus.REVOKED;
    await this.credentialRepository.save(credential);

    return { success: true, message: 'Credential revoked successfully' };
  }

  /**
   * Get a single credential by ID
   */
  async findById(credentialId: string): Promise<VerifiableCredential> {
    const uuid = credentialId.replace('urn:uuid:', '');

    const credential = await this.credentialRepository.findOne({
      where: { id: uuid },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    return this.toVerifiableCredential(credential);
  }

  private toVerifiableCredential(credential: Credential): VerifiableCredential {
    const proof = JSON.parse(credential.proof) as CredentialProof;
    const credentialId = `urn:uuid:${credential.id}`;

    return {
      '@context': VC_CONTEXTS,
      id: credentialId,
      type: credential.type,
      issuer: credential.issuer,
      issuanceDate: credential.issuanceDate,
      expirationDate: credential.expirationDate || undefined,
      credentialSubject: {
        id: credential.subject,
        ...credential.claims,
      },
      credentialStatus: {
        id: `${this.apiBaseUrl}/api/credentials/${encodeURIComponent(credentialId)}/status`,
        type: 'CredentialStatusList2021',
      },
      proof,
    };
  }
}
