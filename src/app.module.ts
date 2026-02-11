import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiAgentModule } from './ai-agent/ai-agent.module';
import { LeadsController } from './leads/leads.controller';

@Module({
  imports: [AiAgentModule],
  controllers: [AppController, LeadsController],
  providers: [AppService],
})
export class AppModule {}
