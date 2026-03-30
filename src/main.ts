import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import dns from 'node:dns/promises';
import * as express from 'express'; // Import express
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Disable verbose logging if not needed for production
    logger: ['error', 'warn', 'log'],
  });
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.enableCors();
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(3003);
  console.log('🚀 Server running on port 3003');
}

bootstrap().catch((err) => {
  console.error('Fatal Error during bootstrap:', err);
});
