import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CredentialController } from './credential.controller';
import { CredentialService } from './credential.service';
import { Credential } from '../../entities/Credential';
import { DidModule } from '../did/did.module';

@Module({
  imports: [TypeOrmModule.forFeature([Credential]), DidModule],
  controllers: [CredentialController],
  providers: [CredentialService],
  exports: [CredentialService],
})
export class CredentialModule {}
