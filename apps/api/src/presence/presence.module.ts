import { Module } from '@nestjs/common';
import { PresenceTracker } from './infrastructure/presence-tracker.js';

@Module({
  providers: [PresenceTracker],
  exports: [PresenceTracker],
})
export class PresenceModule {}
