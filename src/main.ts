import * as dotenv from 'dotenv';
dotenv.config(); 
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws'; // <--- Проверь это

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app)); // <--- Проверь это
  await app.listen(3003);
}
bootstrap();