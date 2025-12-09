import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export interface DIDEvent {
  type: 'OwnerChanged' | 'DelegateChanged' | 'AttributeChanged';
  identity: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
  data: {
    owner?: string;
    delegate?: string;
    delegateType?: string;
    name?: string;
    value?: string;
    validTo?: number;
    previousChange?: number;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class EventGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventGateway.name);
  private connectedClients = 0;

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.connectedClients++;
    this.logger.log(
      `Client connected: ${client.id} (Total: ${this.connectedClients})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.log(
      `Client disconnected: ${client.id} (Total: ${this.connectedClients})`,
    );
  }

  broadcastEvent(event: DIDEvent) {
    this.logger.debug(`Broadcasting event: ${event.type}`);
    this.server.emit('event:new', event);
  }

  getConnectedClients(): number {
    return this.connectedClients;
  }
}
