/* eslint-disable prettier/prettier */
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { GeminiService } from '../gemini/gemini.service';
import * as WebSocket from 'ws';
import { LiveTranscriptionEvents } from "@deepgram/sdk";

@WebSocketGateway({ 
  path: '/media-stream',
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private streamSid: string = '';

  constructor(private readonly geminiService: GeminiService) {}

  handleConnection(twilioWs: WebSocket) {
    console.log('🚀 Twilio connected to WebSocket');

    // 1. Инициализируем Deepgram через наш сервис
    const dgLive = this.geminiService.getDeepgramLive();

    // 2. Настраиваем обработку событий Deepgram
    dgLive.on(LiveTranscriptionEvents.Open, () => {
      console.log('✅ Deepgram Connection Verified & Opened');

      // Слушаем результаты расшифровки только после открытия сокета
      dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
        const transcript = data.channel.alternatives[0]?.transcript;
        
        if (transcript) {
          // Выводим промежуточные результаты (Maya "слышит" в реальном времени)
          console.log(`👤 Hearing: ${transcript}`); 
          
          // Если фраза закончена (пациент замолчал)
          if (data.is_final) {
            console.log(`✅ Final phrase recognized: ${transcript}`);
            
            // Отправляем текст в Groq (мозг)
            try {
              const aiResponse = await this.geminiService.generateResponse(transcript);
              console.log(`🤖 Maya says: ${aiResponse}`);
              // Здесь в будущем будет вызов TTS для отправки голоса обратно в Twilio
            } catch (err) {
              console.error('🔴 Groq Error:', err.message);
            }
          }
        }
      });
    });

    // Логируем ошибки Deepgram
    dgLive.on(LiveTranscriptionEvents.Error, (err) => {
      console.error('🔴 Deepgram WebSocket Error:', err);
    });

    dgLive.on(LiveTranscriptionEvents.Close, () => {
      console.log('🔌 Deepgram Connection Closed');
    });

    // 3. Обработка входящих сообщений от Twilio
    twilioWs.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data);

        switch (msg.event) {
          case 'start':
            this.streamSid = msg.start.streamSid;
            console.log(`📞 Stream SID: ${this.streamSid}`);
            break;

          case 'media':
            // Пересылаем аудио-байты в Deepgram
            // Важно: проверяем состояние готовности (1 = OPEN)
            if (dgLive.getReadyState() === 1) {
              const audioBuffer = Buffer.from(msg.media.payload, 'base64');
              // Используем Uint8Array для совместимости с SDK v3
              dgLive.send(new Uint8Array(audioBuffer) as any);
            }
            break;

          case 'stop':
            console.log('⏹️ Twilio sent stop event');
            if (dgLive.getReadyState() === 1) {
                dgLive.requestClose();
            }
            break;
        }
      } catch (error) {
        console.error('❌ Error processing Twilio message:', error);
      }
    });

    // Сохраняем ссылку на сокет Deepgram в объекте Twilio-сокета для очистки
    (twilioWs as any).dgLive = dgLive;
  }

  handleDisconnect(twilioWs: WebSocket) {
    console.log('❌ Twilio disconnected');
    const dgLive = (twilioWs as any).dgLive;
    if (dgLive && dgLive.getReadyState() === 1) {
      dgLive.requestClose();
    }
  }
}