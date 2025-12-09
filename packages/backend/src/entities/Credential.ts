import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum CredentialStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Entity()
export class Credential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  issuer: string; // Issuer DID (did:ethr:0x...)

  @Column()
  @Index()
  subject: string; // Subject DID (did:ethr:0x...)

  @Column('json')
  type: string[]; // ["VerifiableCredential", "UniversityDegreeCredential"]

  @Column('json')
  claims: Record<string, unknown>; // Credential claims/attributes

  @Column()
  issuanceDate: string; // ISO string (preserved exactly for signature verification)

  @Column({ nullable: true })
  expirationDate: string; // ISO string (nullable)

  @Column({
    type: 'enum',
    enum: CredentialStatus,
    default: CredentialStatus.ACTIVE,
  })
  status: CredentialStatus;

  @Column('text')
  proof: string; // Signature proof (JSON stringified)

  @CreateDateColumn()
  createdAt: Date;
}
