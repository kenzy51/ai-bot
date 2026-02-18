/* eslint-disable prettier/prettier */
import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { GeminiService } from '../gemini/gemini.service';
import * as WebSocket from 'ws';
import { LiveTranscriptionEvents } from '@deepgram/sdk';

@WebSocketGateway({
  path: '/media-stream',
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private streamSid: string = '';

  constructor(private readonly geminiService: GeminiService) {}

  handleConnection(twilioWs: WebSocket) {
    console.log('🚀 Twilio connected to WebSocket');

    const dgLive = this.geminiService.getDeepgramLive();

    // 1. ПРИВЕТСТВИЕ: Срабатывает один раз при открытии соединения
    dgLive.once(LiveTranscriptionEvents.Open, async () => {
      console.log('✅ Deepgram Connection Opened');
      try {
        const greetingText = await this.geminiService.getInitialGreeting();
        const audioBuffer = await this.geminiService.speak(greetingText);

        twilioWs.send(
          JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: { payload: audioBuffer.toString('base64') },
          }),
        );
        console.log('👋 Megan sent initial greeting');
      } catch (err) {
        console.error('🔴 Error sending greeting:', err);
      }
    });

    // 2. ОБРАБОТКА РЕЧИ И ПРЕРЫВАНИЕ (BARGE-IN)
    dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const transcript = data.channel.alternatives[0]?.transcript;

      if (transcript && transcript.trim().length > 0) {
        // --- ЛОГИКА ПРЕРЫВАНИЯ (BARGE-IN) ---
        const interruptMessage = JSON.stringify({
          event: 'clear',
          streamSid: this.streamSid,
        });
        twilioWs.send(interruptMessage);
        // ------------------------------------

        if (!data.is_final) {
          console.log(`👤 Hearing (interim): ${transcript}`);
          return;
        }

        console.log(`✅ Final phrase: ${transcript}`);

        try {
          // Получаем ответ от Майи
          const aiResponse =
            await this.geminiService.generateResponse(transcript);
          console.log(`🤖 Megan says: ${aiResponse}`);

          // Озвучиваем ответ
          const audioBuffer = await this.geminiService.speak(aiResponse);

          // Отправляем аудио в Twilio
          twilioWs.send(
            JSON.stringify({
              event: 'media',
              streamSid: this.streamSid,
              media: { payload: audioBuffer.toString('base64') },
            }),
          );
        } catch (err) {
          console.error('🔴 Error in AI flow:', err);
        }
      }
    });

    // Ошибки и закрытие
    dgLive.on(LiveTranscriptionEvents.Error, (err) => {
      console.error('🔴 Deepgram Error:', err);
    });

    dgLive.on(LiveTranscriptionEvents.Close, () => {
      console.log('🔌 Deepgram Connection Closed');
    });

    // 3. ПЕРЕДАЧА ПОТОКА ОТ TWILIO К DEEPGRAM
    twilioWs.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data);
        switch (msg.event) {
          case 'start':
            this.streamSid = msg.start.streamSid;
            console.log(`📞 Stream SID: ${this.streamSid}`);
            break;
          case 'media':
            if (dgLive.getReadyState() === 1) {
              const audioBuffer = Buffer.from(msg.media.payload, 'base64');
              dgLive.send(new Uint8Array(audioBuffer) as any);
            }
            break;
          case 'stop':
            console.log('⏹️ Twilio sent stop event');
            if (dgLive.getReadyState() === 1) dgLive.requestClose();
            break;
        }
      } catch (error) {
        console.error('❌ Error processing Twilio message:', error);
      }
    });

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
