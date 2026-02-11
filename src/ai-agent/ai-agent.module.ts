import { Module } from '@nestjs/common';
import { GeminiService } from './gemini/gemini.service';
import { VoiceGateway } from './voice/voice.gateway';

@Module({
  providers: [GeminiService, VoiceGateway],
  exports: [GeminiService],
})
export class AiAgentModule {}