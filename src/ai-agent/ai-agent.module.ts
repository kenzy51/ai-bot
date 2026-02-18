import { Module } from '@nestjs/common';
import { GeminiService } from './gemini/gemini.service';
import { VoiceGateway } from './voice/voice.gateway';
import { CallsModule } from 'src/calls/calls.module';

@Module({
  providers: [GeminiService, VoiceGateway],
  exports: [GeminiService],
  imports:[CallsModule]
})
export class AiAgentModule {}
