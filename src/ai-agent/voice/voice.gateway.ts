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
  constructor(private readonly geminiService: VoiceService) {}
  private chatHistories = new Map<WebSocket, any[]>();
  // Tracks CallSid per WebSocket connection
  private sessions = new Map<WebSocket, string>();

  handleConnection(twilioWs: WebSocket) {
    let chatHistory: any[] = [];
    let streamSid: string = '';
    const dgLive = this.geminiService.getDeepgramLive();
    this.chatHistories.set(twilioWs, chatHistory);
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

    dgLive.on(LiveTranscriptionEvents.Open, async () => {
      console.log('✅ Deepgram Ready');
      const greeting = await this.geminiService.getInitialGreeting();
      chatHistory.push({ role: 'assistant', content: greeting });
      const audio = await this.geminiService.speak(greeting);
      sendAudioToTwilio(audio.toString('base64'));
    });

    dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const transcript = data.channel.alternatives[0]?.transcript;
      if (!data.is_final || !transcript || transcript.trim().length < 3) return;

      console.log(`👤 User: ${transcript}`);
      twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));

      chatHistory.push({ role: 'user', content: transcript });
      const aiResponse = await this.geminiService.generateResponse(
        transcript,
        chatHistory,
        (audioBuffer) => {
          sendAudioToTwilio(audioBuffer.toString('base64'));
        },
      );

      if (aiResponse) {
        chatHistory.push({ role: 'assistant', content: aiResponse });
        console.log(`🤖 Jessica: ${aiResponse}`);
      }
    });
    dgLive.on(LiveTranscriptionEvents.Error, (err) => {
      console.error('❌ Deepgram Socket Error:', err);
    });
    twilioWs.on('message', (data: string) => {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        const callSid = msg.start.callSid;

        // CRITICAL: Link this socket to the CallSid for the disconnect trigger
        this.sessions.set(twilioWs, callSid);
        this.geminiService.setCurrentCallSid(callSid);

        console.log(`📞 Call Started: ${callSid}`);
      }

      if (msg.event === 'media' && dgLive.getReadyState() === 1) {
        // @ts-ignore
        dgLive.send(Buffer.from(msg.media.payload, 'base64'));
      }

      if (msg.event === 'stop') {
        console.log('🛑 Twilio sent stop event');
        dgLive.requestClose();
      }
    });
  }

  // This fires when the patient hangs up
  async handleDisconnect(twilioWs: WebSocket) {
    console.log('❌ WebSocket Disconnected');

    const callSid = this.sessions.get(twilioWs);
    const history = this.chatHistories.get(twilioWs);

    if (callSid) {
      console.log(`📊 Finalizing Log and Summary for: ${callSid}`);
      // @ts-ignore
      await this.geminiService.onCallDisconnect(history);

      // Cleanup to prevent memory leaks
      this.sessions.delete(twilioWs);
      this.chatHistories.delete(twilioWs); // <--- ADD THIS LINE
    } else {
      console.log(
        '⚠️ Disconnect detected but no CallSid was found in session map.',
      );
    }
  }
}
