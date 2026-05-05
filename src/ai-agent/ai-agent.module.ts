import { Module } from '@nestjs/common';
import { VoiceGateway } from './voice/voice.gateway';
import { CallsModule } from 'src/calls/calls.module';
import { VoiceService } from './gemini/voice.service';
import { ConfigStore } from './config/config';

@Module({
  providers: [
    VoiceService,
    VoiceGateway,
    ConfigStore, // 2. Add ConfigStore to providers
  ],
  exports: [VoiceService, ConfigStore], // 3. Export both so other modules can use them
  imports: [CallsModule],
})
export class AiAgentModule {}
