import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DidController } from './did.controller';
import { DidService } from './did.service';
import { Identity } from '../../entities/Identity';
import { Delegate } from '../../entities/Delegate';
import { Attribute } from '../../entities/Attribute';
import { Event } from '../../entities/Event';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Identity, Delegate, Attribute, Event]),
  ],
  controllers: [DidController],
  providers: [DidService],
  exports: [DidService],
})
export class DidModule {}
