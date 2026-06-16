import { forwardRef, Module } from '@nestjs/common';
import { SessionsModule } from 'src/sessions/session.module';
import { ConfigStore } from './config/config';
import { ChatGateway } from './chat/chat.gateway';
import { ChatService } from './gemini/chat.service';

// ai-agent.module.ts
@Module({
  imports: [forwardRef(() => SessionsModule)],
  providers: [ChatService, ChatGateway, ConfigStore],
  exports: [ChatService, ConfigStore],
})
export class AiAgentModule {}
