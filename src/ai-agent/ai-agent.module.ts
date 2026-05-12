import { forwardRef, Module } from '@nestjs/common';
import { VoiceGateway } from './voice/voice.gateway';
import { CallsModule } from 'src/calls/calls.module';
import { VoiceService } from './gemini/voice.service';
import { ConfigStore } from './config/config';
import { ChatGateway } from './chat/chat.gateway';

// ai-agent.module.ts
@Module({
  imports: [forwardRef(() => CallsModule)],
  providers: [VoiceService, VoiceGateway, ConfigStore, ChatGateway],
  exports: [VoiceService, ConfigStore],
})
export class AiAgentModule {}
