import { Module } from '@nestjs/common';
import { GeminiService } from './gemini/gemini.service';
import { VoiceGateway } from './voice/voice.gateway';
import { CallsModule } from 'src/calls/calls.module';
import { GeminiService2 } from './gemini/voice.service';

@Module({
  providers: [GeminiService2, VoiceGateway],
  exports: [GeminiService2],
  imports: [CallsModule],
})
export class AiAgentModule {}
