import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { VoiceService } from '../gemini/voice.service';
import * as WebSocket from 'ws';
import { LiveTranscriptionEvents } from '@deepgram/sdk';

@WebSocketGateway({ path: '/media-stream' })
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly voiceService: VoiceService) {}
  private chatHistories = new Map<WebSocket, any[]>();
  // Tracks CallSid per WebSocket connection
  private sessions = new Map<WebSocket, string>();

  handleConnection(twilioWs: WebSocket) {
    console.log('🔌 Twilio WebSocket raw connection opened');
  }

  // --- 1. ТЕПЕРЬ ОБРАБАТЫВАЕМ ВСЁ ВНУТРИ СОБЫТИЯ MESSAGE ---
  async handleMessage(twilioWs: WebSocket, data: string) {
    let chatHistory = this.chatHistories.get(twilioWs) || [];
    let streamSid = '';
    let callSid = '';
    let greetingStarted = false;
    let dgLive: any = null;

    twilioWs.on('message', async (data: string) => {
      const msg = JSON.parse(data);

      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        
        this.sessions.set(twilioWs, callSid);
        this.chatHistories.set(twilioWs, chatHistory);

        // 🔍 ШАГ 1: Извлекаем уже созданную в HTTP-контроллере сессию, чтобы узнать tenantId
        const activeSession = this.voiceService.getActiveSession(callSid);
        if (!activeSession) {
          console.error(`❌ Session fallback failure for CallSid: ${callSid}`);
          twilioWs.close();
          return;
        }

        const tenantId = activeSession.tenantId;

        // Валидируем и закрепляем SID в системе под нужным тенантом
        this.voiceService.setCurrentCallSid(callSid, tenantId);
        console.log(`📞 Dynamic Call Started: ${callSid} | Tenant: ${tenantId}`);

        // 🔍 ШАГ 2: Подтягиваем из базы ключевые слова конкретной компании для Deepgram
        const tenantConfig = await this.voiceService.getTenantConfigById(tenantId);
        const keywords = tenantConfig?.voiceConfig?.keywords || [];

        // Инициализируем Deepgram только сейчас — с персональными ключевыми словами!
        dgLive = this.voiceService.getDeepgramLive(keywords);

        const sendAudioToTwilio = (base64Audio: string) => {
          if (!streamSid) return;
          twilioWs.send(
            JSON.stringify({
              event: 'media',
              streamSid,
              media: { payload: base64Audio },
            }),
          );
        };

        const triggerGreeting = async () => {
          if (greetingStarted || !streamSid || dgLive.getReadyState() !== 1) return;
          greetingStarted = true;

          // Подгружаем кастомное приветствие и ID голоса из MongoDB
          const greeting = tenantConfig?.voiceConfig?.greeting || 'Hello?';
          const voiceId = tenantConfig?.voiceConfig?.voiceId;

          chatHistory.push({ role: 'assistant', content: greeting });
          // @ts-ignore
          const audio = await this.voiceService.speak(greeting, voiceId);
          sendAudioToTwilio(audio.toString('base64'));
        };

        // --- ДИНАМИЧЕСКАЯ ТРАНСКРИБАЦИЯ ВНУТРИ СЕССИИ ---
        dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
          const transcript = data.channel.alternatives[0]?.transcript;

          if (!data.is_final || !transcript || transcript.trim().length < 2) return;

          console.log(`👤 [Tenant: ${tenantId}] User: ${transcript}`);

          // Прерываем речь бота, если пользователь начал говорить (Interruption handling)
          twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));

          chatHistory.push({ role: 'user', content: transcript });

          // Генерируем ответ на основе промптов из MongoDB этого тенанта
          const aiResponse = await this.voiceService.generateResponse(
            transcript,
            chatHistory,
            (audioBuffer) => {
              sendAudioToTwilio(audioBuffer.toString('base64'));
            },
            callSid,
          );

          if (aiResponse) {
            chatHistory.push({ role: 'assistant', content: aiResponse });
            console.log(`🤖 Bot: ${aiResponse}`);
          }
        });

        dgLive.on(LiveTranscriptionEvents.Open, () => {
          console.log('✅ Deepgram Live Stream Matrix Activated');
          triggerGreeting();
        });

        dgLive.on(LiveTranscriptionEvents.Error, (err) => {
          console.error('❌ Deepgram Live Pipeline Error:', err);
        });
      }

      if (msg.event === 'media') {
        // Перенаправляем аудиопоток в Deepgram, только если сокет открыт
        if (dgLive && dgLive.getReadyState() === 1) {
          const audioPayload = msg.media.payload;
          // @ts-ignore
          dgLive.send(Buffer.from(audioPayload, 'base64'));
        }
      }

      if (msg.event === 'stop') {
        console.log('🛑 Twilio stop event received');
        if (dgLive) dgLive.requestClose();
      }
    });
  }

  async handleDisconnect(twilioWs: WebSocket) {
    console.log('❌ WebSocket Disconnected');

    const callSid = this.sessions.get(twilioWs);
    const history = this.chatHistories.get(twilioWs);

    if (callSid && history) {
      console.log(`📊 Finalizing Log Container for SID: ${callSid}`);
      // Метод onCallDisconnect сам закроет сессию и запишет логи в MongoDB нужной компании!
      await this.voiceService.onCallDisconnect(history, callSid);

      this.sessions.delete(twilioWs);
      this.chatHistories.delete(twilioWs);
    }
  }
}