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
    let callSid: string = ''; // 💡 Move this to local scope
    let greetingStarted = false; // 💡 Track to avoid double greeting

    const dgLive = this.voiceService.getDeepgramLive();
    this.chatHistories.set(twilioWs, chatHistory);

    const sendAudioToTwilio = (base64Audio: string) => {
      if (!streamSid) return;
      twilioWs.send(JSON.stringify({ event: 'media', streamSid, media: { payload: base64Audio } }));
    };

    // 💡 CREATE A HELPER FOR THE GREETING
    const triggerGreeting = async () => {
      if (greetingStarted || !streamSid || dgLive.getReadyState() !== 1) return;
      greetingStarted = true;
      
      console.log('✅ Deepgram & Twilio Ready. Triggering Greeting...');
      const greeting = await this.voiceService.getInitialGreeting();
      chatHistory.push({ role: 'assistant', content: greeting });
      const audio = await this.voiceService.speak(greeting);
      sendAudioToTwilio(audio.toString('base64'));
    };

    dgLive.on(LiveTranscriptionEvents.Open, () => {
      console.log('✅ Deepgram Socket Open');
      triggerGreeting(); // Try greeting, but it will wait for streamSid
    });

    // ... (Your Transcription logic stays the same) ...

    twilioWs.on('message', async (data: string) => {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;

        // 💡 Ensure VoiceService knows about this call IMMEDIATELY
        this.sessions.set(twilioWs, callSid);
        this.voiceService.setCurrentCallSid(callSid);

        console.log(`📞 Call Metadata Received: ${callSid}`);
        
        // Now that we have the Sid, trigger the greeting if DG is open
        triggerGreeting(); 
      }

      if (msg.event === 'media' && dgLive.getReadyState() === 1) {
        // @ts-ignore
        dgLive.send(Buffer.from(msg.media.payload, 'base64'));
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
