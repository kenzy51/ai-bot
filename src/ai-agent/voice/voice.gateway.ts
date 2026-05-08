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
    let chatHistory: any[] = [];
    let streamSid: string = '';
    let callSid: string = ''; 
    let greetingStarted = false; 

    const dgLive = this.voiceService.getDeepgramLive();
    this.chatHistories.set(twilioWs, chatHistory);

    const sendAudioToTwilio = (base64Audio: string) => {
      if (!streamSid) return;
      twilioWs.send(JSON.stringify({ event: 'media', streamSid, media: { payload: base64Audio } }));
    };

    const triggerGreeting = async () => {
      if (greetingStarted || !streamSid || dgLive.getReadyState() !== 1) return;
      greetingStarted = true;
      
      const greeting = await this.voiceService.getInitialGreeting();
      chatHistory.push({ role: 'assistant', content: greeting });
      const audio = await this.voiceService.speak(greeting);
      sendAudioToTwilio(audio.toString('base64'));
    };

    // --- 1. THE MISSING TRANSCRIPTION LOGIC ---
    dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const transcript = data.channel.alternatives[0]?.transcript;
      
      // Safety check: Only process final results with actual text
      if (!data.is_final || !transcript || transcript.trim().length < 2) return;

      console.log(`👤 User: ${transcript}`);
      
      // Stop Sarah from speaking if user interrupts (optional but good)
      twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));

      chatHistory.push({ role: 'user', content: transcript });

      const aiResponse = await this.voiceService.generateResponse(
        transcript,
        chatHistory,
        (audioBuffer) => {
          sendAudioToTwilio(audioBuffer.toString('base64'));
        },
      );

      if (aiResponse) {
        chatHistory.push({ role: 'assistant', content: aiResponse });
        console.log(`🤖 Sarah: ${aiResponse}`);
      }
    });

    dgLive.on(LiveTranscriptionEvents.Open, () => {
      console.log('✅ Deepgram Socket Open');
      triggerGreeting();
    });

    dgLive.on(LiveTranscriptionEvents.Error, (err) => {
      console.error('❌ Deepgram Error:', err);
    });

    // --- 2. THE TWILIO MESSAGE HANDLER ---
    twilioWs.on('message', async (data: string) => {
      const msg = JSON.parse(data);
      
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        this.sessions.set(twilioWs, callSid);
        this.voiceService.setCurrentCallSid(callSid);
        console.log(`📞 Call Started: ${callSid}`);
        triggerGreeting(); 
      }

      if (msg.event === 'media') {
        // Only forward audio if Deepgram is ready to listen
        if (dgLive && dgLive.getReadyState() === 1) {
          const audioPayload = msg.media.payload;
          // @ts-ignore
          dgLive.send(Buffer.from(audioPayload, 'base64'));
        }
      }

      if (msg.event === 'stop') {
        console.log('🛑 Twilio stop event received');
        dgLive.requestClose();
      }
    });
  }

  async handleDisconnect(twilioWs: WebSocket) {
    console.log('❌ WebSocket Disconnected');

    const callSid = this.sessions.get(twilioWs);
    const history = this.chatHistories.get(twilioWs);

    if (callSid && history) {
      console.log(`📊 Finalizing Log for SID: ${callSid}`);

      // Pass the callSid EXPLICITLY to the service
      await this.voiceService.onCallDisconnect(history, callSid);

      this.sessions.delete(twilioWs);
      this.chatHistories.delete(twilioWs);
    }
  }
}
