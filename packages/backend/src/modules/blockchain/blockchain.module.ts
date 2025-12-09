import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainService } from './blockchain.service';
import { Event } from '../../entities/Event';
import { Identity } from '../../entities/Identity';
import { Delegate } from '../../entities/Delegate';
import { Attribute } from '../../entities/Attribute';
import { EventGateway } from '../event/event.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Identity, Delegate, Attribute])],
  providers: [BlockchainService, EventGateway],
  exports: [BlockchainService, EventGateway],
})
export class BlockchainModule {}
