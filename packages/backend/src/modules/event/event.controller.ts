import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventService } from './event.service';

@Controller('api/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  async getEvents(
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    return this.eventService.findAll(Number(limit), Number(offset));
  }

  @Get('stats/summary')
  async getStats() {
    return this.eventService.getStats();
  }

  @Get(':identity')
  async getEventsByIdentity(
    @Param('identity') identity: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    return this.eventService.findByIdentity(
      identity,
      Number(limit),
      Number(offset),
    );
  }
}
