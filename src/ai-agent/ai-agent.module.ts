import { forwardRef, Module } from '@nestjs/common';
import { VoiceGateway } from './voice/voice.gateway';
import { CallsModule } from 'src/calls/calls.module';
import { VoiceService } from './gemini/voice.service';
import { ConfigStore } from './config/config';

// ai-agent.module.ts
@Module({
  imports: [
    forwardRef(() => CallsModule), 
  ],
  providers: [
    VoiceService,
    VoiceGateway,
    ConfigStore,
  ],
  exports: [VoiceService, ConfigStore], 
})
export class AiAgentModule {}