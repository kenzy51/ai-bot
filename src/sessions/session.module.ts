import { forwardRef, Module } from '@nestjs/common';
import { SessionsService } from './session.service';
import { SessionsController } from './session.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatSession, ChatSessionSchema } from './schemas/session.schema';
import { AiAgentModule } from 'src/ai-agent/ai-agent.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ChatSession.name, schema: ChatSessionSchema }]),
    forwardRef(() => AiAgentModule),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService, MongooseModule], // Export MongooseModule so AiAgentModule can inject ChatSessionModel
})
export class SessionsModule {}