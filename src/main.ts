import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import { setServers } from 'node:dns/promises';
import dns from 'node:dns/promises';
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap() {
  console.log(process.memoryUsage());
  console.log('Initial Memory:', process.memoryUsage().rss / 1024 / 1024, 'MB');
  const app = await NestFactory.create(AppModule);
  setInterval(() => {
    const mem = process.memoryUsage();
    const format = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

    console.log(`--- Memory Usage ---`);
    console.log(`RSS (Total): ${format(mem.rss)}`);
    console.log(`Heap Total:  ${format(mem.heapTotal)}`);
    console.log(`Heap Used:   ${format(mem.heapUsed)}`);
    console.log(`External:    ${format(mem.external)}`);
  }, 10000); // Logs every 10 seconds
  console.log(
    'Post-Init Memory:',
    process.memoryUsage().rss / 1024 / 1024,
    'MB',
  );
  app.enableCors();
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.listen(3003);
}
bootstrap();
