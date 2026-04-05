import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { GeminiService2 } from '../gemini/gemini.service2';
import * as WebSocket from 'ws';
import { LiveTranscriptionEvents } from '@deepgram/sdk';

@WebSocketGateway({ path: '/media-stream' })
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly geminiService: GeminiService2) {}

  handleConnection(twilioWs: WebSocket) {
    console.log('🚀 Twilio connected. Initializing fresh session.');

    // UNIQUE STATE: This history exists only for this one caller
    let chatHistory: any[] = [];
    let streamSid: string = '';
    const dgLive = this.geminiService.getDeepgramLive();

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
      // Send initial greeting immediately
      const greeting = await this.geminiService.getInitialGreeting();
      chatHistory.push({ role: 'assistant', content: greeting });
      const audio = await this.geminiService.speak(greeting);
      sendAudioToTwilio(audio.toString('base64'));
    });

    dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const transcript = data.channel.alternatives[0]?.transcript;
      if (!data.is_final || !transcript || transcript.trim().length < 3) return;

      console.log(`👤 User: ${transcript}`);
      // 1. Interrupt (Barge-in)
      twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));

      // 2. Add user input to local state
      chatHistory.push({ role: 'user', content: transcript });

      // 3. Generate response using passed-in history
      const aiResponse = await this.geminiService.generateResponse(
        transcript,
        chatHistory,
        (audioBuffer) => {
          // This runs as soon as the first sentence is converted to audio!
          sendAudioToTwilio(audioBuffer.toString('base64'));
        },
      );

      if (aiResponse) {
        chatHistory.push({ role: 'assistant', content: aiResponse });
        console.log(`🤖 Jessica: ${aiResponse}`);
        // const audio = await this.geminiService.speak(aiResponse);
        // sendAudioToTwilio(audio.toString('base64'));
      }
    });

    twilioWs.on('message', (data: string) => {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        this.geminiService.setCurrentCallSid(msg.start.callSid);
      }
      if (msg.event === 'media' && dgLive.getReadyState() === 1) {
        // @ts-ignore
        dgLive.send(Buffer.from(msg.media.payload, 'base64'));
      }
      if (msg.event === 'stop') dgLive.requestClose();
    });
  }

  handleDisconnect() {
    console.log('❌ Call ended');
  }
}
