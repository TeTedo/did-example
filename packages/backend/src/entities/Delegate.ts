import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Identity } from './Identity';

@Entity()
export class Delegate {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Identity, (identity) => identity.delegates)
  identity: Identity;

  @Column()
  delegateType: string;

  @Column()
  delegateAddress: string;

  @Column()
  validTo: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
