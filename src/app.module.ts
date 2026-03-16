import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiAgentModule } from './ai-agent/ai-agent.module';
import { LeadsController } from './leads/leads.controller';
import { CallsModule } from './calls/calls.module';
import { ConfigModule } from '@nestjs/config';
import { config } from 'dotenv';
import { MongooseModule } from '@nestjs/mongoose';
import { CallsController } from './calls/calls.controller';
@Module({
  imports: [
    AiAgentModule,
    CallsModule,
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI!, {
      family: 4, // Forces IPv4 to bypass hotspot/IPv6 issues
      serverSelectionTimeoutMS: 5000, // Faster failure feedback
    }),
  ],
  controllers: [AppController, LeadsController],
  providers: [AppService],
})
export class AppModule {}
