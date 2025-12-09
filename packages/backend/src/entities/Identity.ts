import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Delegate } from './Delegate';
import { Attribute } from './Attribute';

@Entity()
export class Identity {
  @PrimaryColumn()
  address: string;

  @Column({ nullable: true })
  controller: string;

  @OneToMany(() => Delegate, (delegate) => delegate.identity)
  delegates: Delegate[];

  @OneToMany(() => Attribute, (attribute) => attribute.identity)
  attributes: Attribute[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
