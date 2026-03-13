import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws'; 
import { setServers } from 'node:dns/promises';
import dns from 'node:dns/promises';
dns.setServers(['8.8.8.8', '8.8.4.4']); 

async function bootstrap() {
 
  const app = await NestFactory.create(AppModule);
 app.enableCors();
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.listen(3003);
}
bootstrap();
