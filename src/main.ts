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

  // 1. Properly handle both JSON and Form-Url-Encoded data (Twilio Standard)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 2. Enable CORS for your Next.js Dashboard
  app.enableCors({
    origin: '*', // In production, replace with https://dashboard.fusionaiagency.com
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  // 3. Bind the WebSocket adapter for the /media-stream
  app.useWebSocketAdapter(new WsAdapter(app));

  const port = process.env.PORT || 3003;
  
  // 4. Bind to 0.0.0.0 to ensure Render's internal network can route to the app
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Fusion AI Backend live on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Fatal Error during bootstrap:', err);
});