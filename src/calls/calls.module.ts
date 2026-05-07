import { Module } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Call, CallSchema } from './schemas/call.schema';
import { VoiceService } from 'src/ai-agent/gemini/voice.service';
import { ConfigStore } from 'src/ai-agent/config/config';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
  ],
  providers: [CallsService, VoiceService, ConfigStore],
  controllers: [CallsController],
  exports: [CallsService],
})
export class CallsModule {}
