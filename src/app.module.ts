import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiAgentModule } from './ai-agent/ai-agent.module';
import { LeadsController } from './leads/leads.controller';
import { ConfigModule } from '@nestjs/config';
import { config } from 'dotenv';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigStore } from './ai-agent/config/config';
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { SessionsModule } from './sessions/session.module';
@Module({
  imports: [
    AiAgentModule,
    SessionsModule,
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI!, {
      family: 4,
      serverSelectionTimeoutMS: 5000, // Faster failure feedback
    }),
    TenantModule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController, LeadsController],
  providers: [AppService],
})
export class AppModule {}
