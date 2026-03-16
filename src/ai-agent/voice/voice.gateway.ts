// /* eslint-disable prettier/prettier */
// import {
//   WebSocketGateway,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
// } from '@nestjs/websockets';
// import { GeminiService } from '../gemini/gemini.service';
// import * as WebSocket from 'ws';
// import { LiveTranscriptionEvents } from '@deepgram/sdk';

// @WebSocketGateway({
//   path: '/media-stream',
// })
// export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
//   private streamSid: string = '';
//   private isGreetingSent: boolean = false;
//   private isDeepgramReady: boolean = false;
//   constructor(private readonly geminiService: GeminiService) {}

//   handleConnection(twilioWs: WebSocket) {
//     console.log('🚀 Twilio connected to WebSocket');
//     let chatHistory: any[] = []; // Unique to this specific caller
//     const dgLive = this.geminiService.getDeepgramLive();

//     // Helper to send audio to Twilio
//     const sendAudioToTwilio = (base64Audio: string) => {
//       if (!this.streamSid) {
//         console.warn('⚠️ Cannot send audio: streamSid is missing');
//         return;
//       }
//       twilioWs.send(
//         JSON.stringify({
//           event: 'media',
//           streamSid: this.streamSid,
//           media: { payload: base64Audio },
//         }),
//       );
//     };

//     // COORDINATION LOGIC: Greets only when both SID and DG are ready
//     const attemptGreeting = async () => {
//       if (this.isDeepgramReady && this.streamSid && !this.isGreetingSent) {
//         this.isGreetingSent = true; // Prevent double greeting
//         try {
//           console.log('✨ System Ready. Generating initial greeting...');
//           const greetingText = await this.geminiService.getInitialGreeting();
//           const audioBuffer = await this.geminiService.speak(greetingText);
//           sendAudioToTwilio(audioBuffer.toString('base64'));
//           console.log('👋 Jessica sent initial greeting');
//         } catch (err) {
//           console.error('🔴 Greeting Error:', err);
//         }
//       }
//     };

//     dgLive.on(LiveTranscriptionEvents.Open, () => {
//       console.log('✅ Deepgram Connection Opened');
//       this.isDeepgramReady = true;
//       attemptGreeting();
//     });

//     dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
//       const transcript = data.channel.alternatives[0]?.transcript;

//       if (transcript && transcript.trim().length > 2) {
//         // --- BARGE-IN (Interruption) ---
//         // Tells Twilio to stop playing current audio buffer because user is speaking
//         twilioWs.send(
//           JSON.stringify({
//             event: 'clear',
//             streamSid: this.streamSid,
//           }),
//         );

//         if (!data.is_final) return;

//         console.log(`👤 User: ${transcript}`);
//         // Add an AbortController to your handleConnection
//         const controller = new AbortController();

//         // When user speaks:
//         controller.abort(); // Cancel the previous AI request
//         const newController = new AbortController();
//         const aiResponse = await this.geminiService.generateResponse(
//           transcript,
//           chatHistory,
//           newController.signal,
//         );
//         try {
//           const aiResponse = await this.geminiService.generateResponse(
//             transcript,
//             chatHistory,
//           );
//           // Update local history
//           chatHistory.push({ role: 'user', content: transcript });
//           chatHistory.push({ role: 'assistant', content: aiResponse });
//           if (!aiResponse) return;

//           console.log(`🤖 Jessica: ${aiResponse}`);
//           const audioBuffer = await this.geminiService.speak(aiResponse);
//           sendAudioToTwilio(audioBuffer.toString('base64'));
//         } catch (err) {
//           console.error('🔴 AI Flow Error:', err);
//         }
//       }
//     });

//     // Handle Twilio Messages
//     twilioWs.on('message', (data: string) => {
//       try {
//         const msg = JSON.parse(data);
//         switch (msg.event) {
//           case 'start':
//             this.streamSid = msg.start.streamSid;
//             console.log(`📞 Stream SID Captured: ${this.streamSid}`);
//             attemptGreeting(); // Check if DG is already open
//             break;

//           case 'media':
//             if (dgLive.getReadyState() === 1) {
//               const audioBuffer = Buffer.from(msg.media.payload, 'base64');
//               dgLive.send(new Uint8Array(audioBuffer) as any);
//             }
//             break;

//           case 'stop':
//             console.log('⏹️ Call stopped by Twilio');
//             this.geminiService.onCallDisconnect();
//             if (dgLive.getReadyState() === 1) dgLive.requestClose();
//             break;
//         }
//       } catch (error) {
//         console.error('❌ Twilio Message Parse Error:', error);
//       }
//     });

//     dgLive.on(LiveTranscriptionEvents.Error, (err) =>
//       console.error('🔴 DG Error:', err),
//     );

//     (twilioWs as any).dgLive = dgLive;
//   }

//   handleDisconnect(twilioWs: WebSocket) {
//     console.log('❌ Twilio disconnected');
//     this.geminiService.onCallDisconnect();
//     const dgLive = (twilioWs as any).dgLive;
//     if (dgLive && dgLive.getReadyState() === 1) {
//       dgLive.requestClose();
//     }
//   }
// }

// import {
//   WebSocketGateway,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
// } from '@nestjs/websockets';
// import { GeminiService } from '../gemini/gemini.service';
// import * as WebSocket from 'ws';
// import { LiveTranscriptionEvents } from '@deepgram/sdk';

// @WebSocketGateway({ path: '/media-stream' })
// export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
//   constructor(private readonly geminiService: GeminiService) {}

//   // Track active streamSids for cleanup
//   private connectionMap = new Map<WebSocket, string>();
//   // Lock to prevent concurrent AI processing for a specific stream
//   private isProcessingMap = new Map<string, boolean>();

//   handleConnection(twilioWs: WebSocket) {
//     console.log('🚀 Twilio connected.');

//     let chatHistory: any[] = [];
//     let streamSid: string = '';
//     const dgLive = this.geminiService.getDeepgramLive();
//     // @ts-ignore
//     dgLive.on(LiveTranscriptionEvents.Warning, (warn) =>
//       console.warn('⚠️ DG Warning:', warn),
//     );
//     // Add this to see if the AI even hears silence
//     dgLive.on('speech_started', () => console.log('🎤 User started speaking'));
//     dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
//       const transcript = data.channel.alternatives[0]?.transcript;

//       // Ignore interim results or empty input
//       if (!data.is_final || !transcript || transcript.trim().length < 3) return;

//       // If already processing for this SID, skip
//       if (this.isProcessingMap.get(streamSid)) return;

//       console.log(`👤 User: ${transcript}`);
//       this.isProcessingMap.set(streamSid, true);

//       // 1. Interrupt (Barge-in)
//       twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));

//       // 2. Add user input to local state
//       chatHistory.push({ role: 'user', content: transcript });

//       try {
//         // 3. Generate response (geminiService.generateResponse handles audio streaming)
//         const aiResponse = await this.geminiService.generateResponse(
//           transcript,
//           chatHistory,
//           twilioWs,
//           streamSid,
//         );

//         if (aiResponse) {
//           chatHistory.push({ role: 'assistant', content: aiResponse });
//           console.log(`🤖 Jessica: ${aiResponse}`);
//         }
//       } catch (err) {
//         console.error('🔴 Gateway AI Error:', err);
//       } finally {
//         this.isProcessingMap.set(streamSid, false);
//       }
//     });

//     twilioWs.on('message', async (data: string) => {
//       const msg = JSON.parse(data);

//       if (msg.event === 'start') {
//         streamSid = msg.start.streamSid;
//         this.connectionMap.set(twilioWs, streamSid);
//         console.log(`✅ Stream started: ${streamSid}`);

//         // Greeting only happens ONCE upon start event
//         const greeting = await this.geminiService.getInitialGreeting();
//         await this.geminiService.streamTts(greeting, streamSid, twilioWs);
//         chatHistory.push({ role: 'assistant', content: greeting });
//       }

//       if (msg.event === 'media' && dgLive.getReadyState() === 1) {
//         const audioBuffer = Buffer.from(msg.media.payload, 'base64');
//         // @ts-ignore
//         dgLive.send(new Uint8Array(audioBuffer));
//       } else if (msg.event === 'media' && dgLive.getReadyState() !== 1) {
//         // If it's not ready, try to re-init
//         console.warn(
//           '⚠️ Deepgram not ready (State: ' +
//             dgLive.getReadyState() +
//             '). Attempting to skip audio.',
//         );
//       }

//       if (msg.event === 'stop') {
//         this.cleanup(twilioWs);
//       }
//     });
//   }

//   private cleanup(twilioWs: WebSocket) {
//     const streamSid = this.connectionMap.get(twilioWs);
//     if (streamSid) {
//       this.geminiService.cleanup(streamSid);
//       this.connectionMap.delete(twilioWs);
//       this.isProcessingMap.delete(streamSid);
//     }
//   }

//   handleDisconnect(twilioWs: WebSocket) {
//     console.log('❌ Call ended');
//     this.cleanup(twilioWs);
//     this.geminiService.onCallDisconnect();
//   }
// }

import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { GeminiService } from '../gemini/gemini.service';
import * as WebSocket from 'ws';
import { LiveTranscriptionEvents } from '@deepgram/sdk';

@WebSocketGateway({ path: '/media-stream' })
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly geminiService: GeminiService) {}

  private isProcessingMap = new Map<string, boolean>();

  handleConnection(twilioWs: WebSocket) {
    let streamSid: string = '';
    let chatHistory: any[] = [];
    let isDgReady = false;

    const dgLive = this.geminiService.getDeepgramLive();
    console.log('🔗 Attempting to connect to Deepgram...');
    dgLive.on(LiveTranscriptionEvents.Open, async () => {
      isDgReady = true;
      console.log('✅ Deepgram Ready, sending greeting...');
    
    });
    dgLive.on(LiveTranscriptionEvents.Error, (err) => {
      console.error('❌ Deepgram Error:', err);
    });
    dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const transcript = data.channel.alternatives[0]?.transcript;
      if (!data.is_final || !transcript || transcript.trim().length < 3) return;
      if (this.isProcessingMap.get(streamSid)) return;
      isDgReady = true;
      this.isProcessingMap.set(streamSid, true);
      twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
      chatHistory.push({ role: 'user', content: transcript });

      try {
        const aiResponse = await this.geminiService.generateResponse(
          transcript,
          chatHistory,
          twilioWs,
          streamSid,
        );
        if (aiResponse)
          chatHistory.push({ role: 'assistant', content: aiResponse });
      } finally {
        this.isProcessingMap.set(streamSid, false);
      }
    });

  // --- INSIDE VoiceGateway.ts ---

twilioWs.on('message', async (data: string) => {
  const msg = JSON.parse(data);
  
  if (msg.event === 'start') {
    streamSid = msg.start.streamSid;
    
    // Only greet once here.
    const greeting = await this.geminiService.getInitialGreeting();
    await this.geminiService.streamTts(greeting, streamSid, twilioWs);
    chatHistory.push({ role: 'assistant', content: greeting });
  }

  if (msg.event === 'media') {
    // Only send to DG if it is actually in the OPEN state
    if (dgLive.getReadyState() === 1) { 
      // @ts-ignore
      dgLive.send(Buffer.from(msg.media.payload, 'base64'));
    }
  }
});
  }

  handleDisconnect(twilioWs: WebSocket) {
    // this.geminiService.onCallDisconnect();
  }
}
