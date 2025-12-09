import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../../entities/Event';

export interface EventStats {
  totalEvents: number;
  ownerChanges: number;
  delegateChanges: number;
  attributeChanges: number;
  uniqueIdentities: number;
}

interface EventArgs {
  identity?: string;
  owner?: string;
  delegate?: string;
  delegateType?: string;
  name?: string;
  value?: string;
  validTo?: string;
  previousChange?: string;
}

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  async findAll(limit: number = 10, offset: number = 0) {
    const [events, total] = await this.eventRepository.findAndCount({
      take: limit,
      skip: offset,
      order: {
        createdAt: 'DESC',
      },
    });

    // Transform events to match frontend expected format
    const transformedEvents = events.map((event) => {
      const args = event.args as EventArgs | null;
      return {
        type: this.mapEventName(event.eventName),
        identity: args?.identity ?? '',
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: event.createdAt.getTime(),
        data: {
          owner: args?.owner,
          delegate: args?.delegate,
          delegateType: args?.delegateType,
          name: args?.name,
          value: args?.value,
          validTo: args?.validTo ? Number(args.validTo) : undefined,
          previousChange: args?.previousChange
            ? Number(args.previousChange)
            : undefined,
        },
      };
    });

    return {
      events: transformedEvents,
      total,
      limit,
      offset,
    };
  }

  async findByIdentity(
    identity: string,
    limit: number = 10,
    offset: number = 0,
  ) {
    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .where("JSON_EXTRACT(event.args, '$.identity') = :identity", {
        identity: identity.toLowerCase(),
      })
      .orWhere("JSON_EXTRACT(event.args, '$.identity') = :identityUpper", {
        identityUpper: identity,
      })
      .orderBy('event.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    const [events, total] = await queryBuilder.getManyAndCount();

    const transformedEvents = events.map((event) => {
      const args = event.args as EventArgs | null;
      return {
        type: this.mapEventName(event.eventName),
        identity: args?.identity ?? '',
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: event.createdAt.getTime(),
        data: {
          owner: args?.owner,
          delegate: args?.delegate,
          delegateType: args?.delegateType,
          name: args?.name,
          value: args?.value,
          validTo: args?.validTo ? Number(args.validTo) : undefined,
          previousChange: args?.previousChange
            ? Number(args.previousChange)
            : undefined,
        },
      };
    });

    return {
      events: transformedEvents,
      total,
      limit,
      offset,
    };
  }

  async getStats(): Promise<EventStats> {
    const [totalEvents, ownerChanges, delegateChanges, attributeChanges] =
      await Promise.all([
        this.eventRepository.count(),
        this.eventRepository.count({
          where: { eventName: 'DIDOwnerChanged' },
        }),
        this.eventRepository.count({
          where: { eventName: 'DIDDelegateChanged' },
        }),
        this.eventRepository.count({
          where: { eventName: 'DIDAttributeChanged' },
        }),
      ]);

    // Get unique identities count
    const uniqueIdentitiesResult: { count: string } | undefined =
      await this.eventRepository
        .createQueryBuilder('event')
        .select(
          "COUNT(DISTINCT JSON_EXTRACT(event.args, '$.identity'))",
          'count',
        )
        .getRawOne();

    return {
      totalEvents,
      ownerChanges,
      delegateChanges,
      attributeChanges,
      uniqueIdentities: parseInt(uniqueIdentitiesResult?.count ?? '0', 10),
    };
  }

  private mapEventName(
    eventName: string,
  ): 'OwnerChanged' | 'DelegateChanged' | 'AttributeChanged' {
    switch (eventName) {
      case 'DIDOwnerChanged':
        return 'OwnerChanged';
      case 'DIDDelegateChanged':
        return 'DelegateChanged';
      case 'DIDAttributeChanged':
        return 'AttributeChanged';
      default:
        return 'OwnerChanged';
    }
  }
}
