import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Identity } from './entities/Identity';
import { Delegate } from './entities/Delegate';
import { Attribute } from './entities/Attribute';
import { Event } from './entities/Event';
import { Credential } from './entities/Credential';
import { DidModule } from './modules/did/did.module';
import { EventModule } from './modules/event/event.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { CredentialModule } from './modules/credential/credential.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', 'password'),
        database: configService.get<string>('DB_DATABASE', 'ethereum_did'),
        entities: [Identity, Delegate, Attribute, Event, Credential],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        // logging: configService.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    DidModule,
    EventModule,
    BlockchainModule,
    CredentialModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
