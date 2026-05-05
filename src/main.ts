import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import dns from 'node:dns/promises';
import * as express from 'express'; 

dns.setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // 1. MUST come before other middleware to ensure Twilio's Form-Url-Encoded 
  // data is parsed before the request hits your controllers.
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.enableCors();
  
  // 2. Ensure your WsAdapter is correctly bound
  app.useWebSocketAdapter(new WsAdapter(app));

  // 3. Use process.env.PORT for Render compatibility
  const port = process.env.PORT || 3003;
  await app.listen(port, '0.0.0.0'); // Adding '0.0.0.0' helps with Render routing
  
  console.log(`🚀 Server running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Fatal Error during bootstrap:', err);
});