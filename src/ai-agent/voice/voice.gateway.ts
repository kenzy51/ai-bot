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
  private isGreetingSent: boolean = false;
  private isDeepgramReady: boolean = false;

  constructor(private readonly geminiService: GeminiService) {}

  handleConnection(twilioWs: WebSocket) {
    console.log('🚀 Twilio connected to WebSocket');

    const dgLive = this.geminiService.getDeepgramLive();

    // Helper to send audio to Twilio
    const sendAudioToTwilio = (base64Audio: string) => {
      if (!this.streamSid) {
        console.warn('⚠️ Cannot send audio: streamSid is missing');
        return;
      }
      twilioWs.send(
        JSON.stringify({
          event: 'media',
          streamSid: this.streamSid,
          media: { payload: base64Audio },
        }),
      );
    };

    // COORDINATION LOGIC: Greets only when both SID and DG are ready
    const attemptGreeting = async () => {
      if (this.isDeepgramReady && this.streamSid && !this.isGreetingSent) {
        this.isGreetingSent = true; // Prevent double greeting
        try {
          console.log('✨ System Ready. Generating initial greeting...');
          const greetingText = await this.geminiService.getInitialGreeting();
          const audioBuffer = await this.geminiService.speak(greetingText);
          sendAudioToTwilio(audioBuffer.toString('base64'));
          console.log('👋 Jessica sent initial greeting');
        } catch (err) {
          console.error('🔴 Greeting Error:', err);
        }
      }
    };

    dgLive.on(LiveTranscriptionEvents.Open, () => {
      console.log('✅ Deepgram Connection Opened');
      this.isDeepgramReady = true;
      attemptGreeting();
    });

    dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const transcript = data.channel.alternatives[0]?.transcript;

      if (transcript && transcript.trim().length > 2) {
        // --- BARGE-IN (Interruption) ---
        // Tells Twilio to stop playing current audio buffer because user is speaking
        twilioWs.send(JSON.stringify({
          event: 'clear',
          streamSid: this.streamSid,
        }));

        if (!data.is_final) return;

        console.log(`👤 User: ${transcript}`);

        try {
          const aiResponse = await this.geminiService.generateResponse(transcript);
          if (!aiResponse) return;

          console.log(`🤖 Jessica: ${aiResponse}`);
          const audioBuffer = await this.geminiService.speak(aiResponse);
          sendAudioToTwilio(audioBuffer.toString('base64'));
        } catch (err) {
          console.error('🔴 AI Flow Error:', err);
        }
      }
    });

    // Handle Twilio Messages
    twilioWs.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data);
        switch (msg.event) {
          case 'start':
            this.streamSid = msg.start.streamSid;
            console.log(`📞 Stream SID Captured: ${this.streamSid}`);
            attemptGreeting(); // Check if DG is already open
            break;

          case 'media':
            if (dgLive.getReadyState() === 1) {
              const audioBuffer = Buffer.from(msg.media.payload, 'base64');
              dgLive.send(new Uint8Array(audioBuffer) as any);
            }
            break;

          case 'stop':
            console.log('⏹️ Call stopped by Twilio');
            this.geminiService.onCallDisconnect();
            if (dgLive.getReadyState() === 1) dgLive.requestClose();
            break;
        }
      } catch (error) {
        console.error('❌ Twilio Message Parse Error:', error);
      }
    });

    dgLive.on(LiveTranscriptionEvents.Error, (err) => console.error('🔴 DG Error:', err));
    
    (twilioWs as any).dgLive = dgLive;
  }

  handleDisconnect(twilioWs: WebSocket) {
    console.log('❌ Twilio disconnected');
    this.geminiService.onCallDisconnect();
    const dgLive = (twilioWs as any).dgLive;
    if (dgLive && dgLive.getReadyState() === 1) {
      dgLive.requestClose();
    }
  }
}