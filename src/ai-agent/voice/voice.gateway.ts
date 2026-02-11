/* eslint-disable prettier/prettier */
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { GeminiService } from '../gemini/gemini.service';
import * as WebSocket from 'ws';

@WebSocketGateway({ 
  path: '/media-stream',
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private streamSid: string = '';

  constructor(private readonly geminiService: GeminiService) {}

  handleConnection(twilioWs: WebSocket) {
    console.log('🚀 Twilio connected to WebSocket');

    // 1. Подключаемся к Gemini через сервис
    const geminiWs = this.geminiService.connectToGemini();

    // 2. Слушаем сообщения от Twilio
    twilioWs.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data);

        switch (msg.event) {
          case 'start':
            this.streamSid = msg.start.streamSid;
            console.log(`📞 Stream SID: ${this.streamSid}`);
            break;

          case 'media':
            // Пересылаем аудио в Gemini, если сокет открыт
            if (geminiWs.readyState === WebSocket.OPEN) {
              const geminiPayload = {
                realtime_input: {
                  media_chunks: [
                    {
                      mime_type: 'audio/mulaw',
                      data: msg.media.payload, // Base64 от Twilio
                    },
                  ],
                },
              };
              geminiWs.send(JSON.stringify(geminiPayload));
            }
            break;

          case 'stop':
            console.log('⏹️ Twilio sent stop event');
            geminiWs.close();
            break;
        }
      } catch (error) {
        console.error('❌ Error processing Twilio message:', error);
      }
    });

    // 3. Слушаем ответы от Gemini и пересылаем их в Twilio
    geminiWs.on('message', (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString());
        
        // Извлекаем аудио из структуры Gemini Live API
        const audioPayload = response.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;

        if (audioPayload && twilioWs.readyState === WebSocket.OPEN) {
          console.log(`🎵 Maya is speaking: sending ${audioPayload.length} bytes to Twilio`);
          
          const twilioMessage = JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: {
              payload: audioPayload,
            },
          });
          
          twilioWs.send(twilioMessage);
        }
      } catch (error) {
        // Игнорируем ошибки парсинга для не-аудио ответов (например, setup подтверждение)
      }
    });

    geminiWs.on('error', (err) => {
      console.error('🔴 Gemini WebSocket Error:', err);
    });

    geminiWs.on('close', () => {
      console.log('🔌 Gemini connection closed');
    });

    // Сохраняем ссылку, чтобы закрыть при дисконнекте Twilio
    (twilioWs as any).geminiWs = geminiWs;
  }

  handleDisconnect(twilioWs: WebSocket) {
    console.log('❌ Twilio disconnected');
    const geminiWs = (twilioWs as any).geminiWs;
    if (geminiWs) {
      geminiWs.close();
    }
  }
}