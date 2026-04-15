import { Module } from '@nestjs/common';
// import { GeminiService } from './gemini/gemini.service';
import { VoiceGateway } from './voice/voice.gateway';
import { CallsModule } from 'src/calls/calls.module';
import { VoiceService } from './gemini/voice.service';

@Module({
  providers: [VoiceService, VoiceGateway],
  exports: [VoiceService],
  imports: [CallsModule],
})
export class AiAgentModule {}
