// // this is test version which will be for next
// import { Injectable, OnModuleInit } from '@nestjs/common';
// import { DeepgramClient, createClient } from '@deepgram/sdk';
// import Groq from 'groq-sdk';
// import { google } from 'googleapis';
// import twilio from 'twilio';
// import { TRT_LOGISTICS_KNOWLEDGE } from './clinic-info';
// import { ElevenLabsClient } from 'elevenlabs';
// import sgMail from '@sendgrid/mail';
// import { CallsService } from 'src/calls/calls.service';
// import { ConfigStore } from '../config/config';
// @Injectable()
// export class VoiceService implements OnModuleInit {
//   private deepgram: DeepgramClient;
//   private groq: Groq;
//   private calendar;
//   private twilioClient: twilio.Twilio;
//   private elevenlabs: ElevenLabsClient;
//   private lastAction = '';
//   private isLogging = false;
//   private callMap = new Map<string, string>();
//   private activeSessions = new Map<
//     string,
//     {
//       isProcessing: boolean;
//       phone: string;
//       callStatus: string;
//     }
//   >();

//   constructor(
//     private readonly callsService: CallsService,
//     private readonly configStore: ConfigStore,
//   ) {
//     sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
//     this.elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVEN });
//     this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
//     this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
//     this.twilioClient = twilio(
//       process.env.TWILIO_ACCOUNT_SID,
//       process.env.TWILIO_AUTH_TOKEN,
//     );
//     const credentialsGoogleCalendar = JSON.parse(
//       process.env.GOOGLE_CREDS_JSON!,
//     );
//     const auth = new google.auth.GoogleAuth({
//       keyFile: './google.json',
//       scopes: ['https://www.googleapis.com/auth/calendar'],
//     });
//     this.calendar = google.calendar({ version: 'v3', auth });
//   }
//   setCurrentCallSid(sid: string) {
//     this.currentCallSid = sid;
//   }
//   setCallerData(sid: string, phone: string) {
//     this.callMap.set(sid, phone);

//     this.activeSessions.set(sid, {
//       isProcessing: false,
//       phone: phone,
//       callStatus: 'inquiry',
//     });
//     this.callMap.set(sid, phone);
//     console.log(`💾 Map & Fallback Updated: ${sid} -> ${phone}`);
//   }
//   async onModuleInit() {
//     // await this.makeOutboundCall('+19297696545');
//     console.log('🚀 Fusion AI Backend Started.');
//   }

//   async makeOutboundCall(to: string) {
//     try {
//       const call = await this.twilioClient.calls.create({
//         url: `https://${process.env.SERVER_URL}/calls/incoming-call`,
//         to: to,
//         from: '+19297022797',
//         // THIS IS THE KEY:
//         record: true,
//         recordingStatusCallback: `https://${process.env.SERVER_URL}/calls/recording-callback`,
//         recordingStatusCallbackMethod: 'POST',
//       });
//       console.log(`📞 Call initiated: ${call.sid}`);
//     } catch (error) {
//       console.error('❌ Call failed:', error);
//     }
//   }
//   private readonly DEPARTMENTS = {
//     sales: '+19177826487',
//     dispatch: '+19177826487',
//   };

//   private getGroqTools(): any[] {
//     return [
//       {
//         type: 'function',
//         function: {
//           name: 'transfer_to_department',
//           description:
//             'Transfers the caller to a specific department based on their need.',
//           parameters: {
//             type: 'object',
//             properties: {
//               dept: {
//                 type: 'string',
//                 enum: Object.keys(this.DEPARTMENTS), // ['sales', 'dispatch']
//                 description: 'The department key to transfer to.',
//               },
//             },
//             required: ['dept'],
//           },
//           required: ['dept'],
//         },
//       },
//       {
//         type: 'function',
//         function: {
//           name: 'schedule_logistics_consult',
//           description:
//             'Schedules a follow-up call with a logistics expert. ONLY call this if the user gives a specific time.',
//           parameters: {
//             type: 'object',
//             properties: {
//               cargoType: {
//                 type: 'string',
//                 description: 'Type of cargo (e.g. Oversize machinery, Vehicle)',
//               },
//               dateTime: {
//                 type: 'string',
//                 description: 'ISO 8601 format: YYYY-MM-DDTHH:mm:ss',
//               },
//             },
//             required: ['cargoType', 'dateTime'],
//           },
//         },
//       },
//     ];
//   }

//   async generateResponse(
//     userText: string,
//     passedHistory: any[],
//     onAudioData: (buffer: Buffer) => void,
//     callSid: string,
//   ) {
//     if (!this.activeSessions.has(callSid)) {
//       const backupPhone = this.callMap.get(callSid) || 'Unknown';
//       this.activeSessions.set(callSid, {
//         isProcessing: false,
//         phone: backupPhone,
//         callStatus: 'inquiry',
//       });
//     }
//     const session = this.activeSessions.get(callSid)!;
//     // STEP 2
//     if (session.isProcessing) return '';
//     session.isProcessing = true;
//     const dynamicKnowledge = this.configStore.getKnowledge();
//     const dynamicSystemPrompt = this.configStore.getVoicePrompt();
//     const leanHistory = passedHistory.slice(-10);
//     const now = new Date();

//     const nyTime = now.toLocaleString('en-US', {
//       timeZone: 'America/New_York',
//       weekday: 'long',
//       year: 'numeric',
//       month: 'short',
//       day: 'numeric',
//       hour: 'numeric',
//       minute: '2-digit',
//       hour12: true,
//     });
//     const isWeekday = [0, 1, 2, 3, 4].includes(now.getDay());
//     try {
//       const response = await this.groq.chat.completions.create({
//         model: 'llama-3.1-8b-instant',
//         messages: [
//           {
//             role: 'system',
//             content: `
//             # REAL-TIME CLOCK
// Current NYC time: ${nyTime}
// ${dynamicSystemPrompt}
// # KNOWLEDGE
// ${dynamicKnowledge}
// `,
//           },
//           ...leanHistory,
//         ],
//         tools: this.getGroqTools() as any,
//         tool_choice: 'auto',
//         temperature: 0.7,
//         stream: true,
//       });
//       let fullContent = '';
//       let sentenceBuffer = '';
//       let speechQueue = Promise.resolve();
//       const fastFillers = [
//         'got it',
//         'sure thing',
//         'i see',
//         'great question',
//         'sure',
//       ];
//       let firstChunkSent = false;
//       for await (const chunk of response) {
//         const content = chunk.choices[0]?.delta?.content || '';
//         if (content) {
//           fullContent += content;
//           sentenceBuffer += content;
//           // 1. FAST FILLER TRIGGER (Smoother)
//           const words = sentenceBuffer.trim().split(/\s+/);
//           if (!firstChunkSent) {
//             const currentBuffer = sentenceBuffer.toLowerCase().trim();
//             const matchingFiller = fastFillers.find((f) =>
//               currentBuffer.startsWith(f),
//             );

//             if (matchingFiller) {
//               const fillerToSpeak = matchingFiller;
//               sentenceBuffer = sentenceBuffer
//                 .substring(matchingFiller.length)
//                 .trim();
//               firstChunkSent = true;

//               speechQueue = speechQueue.then(async () => {
//                 const audioBuffer = await this.speak(fillerToSpeak);
//                 onAudioData(audioBuffer);
//                 console.log(`⚡ INSTANT FILLER: ${fillerToSpeak}`);
//               });
//             }
//           }

//           if (/[.!?]/.test(content)) {
//             const trimmedBuffer = sentenceBuffer.trim();
//             const isTitle = /\b(dr|mr|ms|mrs|st)\.$/i.test(trimmedBuffer);

//             if (trimmedBuffer && !isTitle) {
//               const speechOutput = trimmedBuffer;
//               sentenceBuffer = '';
//               firstChunkSent = true;

//               speechQueue = speechQueue.then(async () => {
//                 const audioBuffer = await this.speak(speechOutput);
//                 onAudioData(audioBuffer);
//                 console.log(`🔊 Sent to Voice: ${speechOutput}`);
//               });
//             }
//           }
//         }

//         // 🔀 Context-Aware Department Router Hook
//         const toolCall = chunk.choices[0]?.delta?.tool_calls?.[0];
//         if (toolCall?.function?.name === 'transfer_to_department') {
//           const args = JSON.parse(toolCall.function.arguments || '{}');
//           const targetDept = args.dept;
//           const targetNumber = this.DEPARTMENTS[targetDept];

//           if (targetNumber) {
//             console.log(
//               `🔀 Sarah routing individual line ${callSid} to ${targetDept}: ${targetNumber}`,
//             );
//             await this.executeTransfer(callSid, targetNumber); // 💡 Uses localized identifier
//             return `One moment, I'm connecting you to our ${targetDept.replace('_', ' ')} team.`;
//           }
//         }
//       }
//       // TRICK
//       if (sentenceBuffer.trim()) {
//         const finalText = sentenceBuffer.trim();
//         speechQueue = speechQueue.then(async () => {
//           const audioBuffer = await this.speak(finalText);
//           onAudioData(audioBuffer);
//           console.log(`🔊 Final Chunk Sent: ${finalText}`);
//         });
//       }

//       return fullContent;
//     } catch (err) {
//       console.error('❌ Groq/Streaming Error:', err);
//       return "I'm having a bit of trouble with my connection. Could you repeat that?";
//     } finally {
//       session.isProcessing = false;
//     }
//   }
//   // ONLY TEXT
//   // Inside VoiceService class in voice.service.ts

//   async generateTextOnlyResponse(userText: string, passedHistory: any[]) {
//     const dynamicKnowledge = this.configStore.getKnowledge();
//     const dynamicSystemChatPrompt = this.configStore.getChatPrompt();
//     const leanHistory = passedHistory.slice(-10);

//     try {
//       const response = await this.groq.chat.completions.create({
//         model: 'llama-3.1-8b-instant',
//         messages: [
//           {
//             role: 'system',
//             content: `
// # ROLE
// You are Sarah, a Logistics Coordinator at TRT International.
// (Note: You are currently chatting via text on the website).

// ${dynamicSystemChatPrompt}

// # KNOWLEDGE
// ${dynamicKnowledge}
// `,
//           },
//           ...leanHistory,
//           { role: 'user', content: userText },
//         ],
//         temperature: 0.7,
//       });

//       return (
//         response.choices[0]?.message?.content ||
//         "I'm sorry, I couldn't process that."
//       );
//     } catch (err) {
//       console.error('❌ Groq Chat Error:', err);
//       return "I'm having trouble connecting to my logistics database. Please try again in a moment.";
//     }
//   }
//   async executeTransfer(sid: string, phoneNumber: string) {
//     try {
//       await this.twilioClient.calls(sid).update({
//         url: `https://fusion-ai-bot.onrender.com/calls/transfer-dial?to=${encodeURIComponent(phoneNumber)}`,
//         method: 'POST',
//       });
//     } catch (err) {
//       console.error('❌ Transfer Failed:', err);
//     }
//   }
//   async onCallDisconnect(finalHistory: any[], sid: string) {
//     if (this.isLogging) return;
//     this.isLogging = true;

//     await this.logToDatabase('inquiry', sid, finalHistory);

//     const transcriptString = finalHistory
//       .map((h) => `<b>${h.role}:</b> ${h.content}`)
//       .join('<br>');

//     const phoneNumber = this.callMap.get(sid) || 'Unknown';
//     await this.handleNotifications(
//       `Inquiry (${phoneNumber})`,
//       new Date().toLocaleString(),
//       transcriptString,
//     );

//     this.activeSessions.delete(sid);
//     this.callMap.delete(sid);
//     this.isLogging = false;
//     console.log(
//       `♻️ Concurrency Pipeline Purged for Session ${sid}. Resources completely recycled.`,
//     );
//   }

//   private async logToDatabase(status: string, sid: string, history: any[]) {
//     try {
//       let phoneNumber = this.callMap.get(sid);

//       // 2. Emergency Fallback: If map fails, look for the most recent number set in the class
//       if (!phoneNumber || phoneNumber === 'Unknown') {
//         phoneNumber = this.currentCallerPhone || 'Unknown';
//       }

//       console.log(
//         `💾 DB SAVE FINAL CHECK - SID: ${sid} | Found Phone: ${phoneNumber}`,
//       );
//       let dbSummary = 'Inquiry TRT';

//       if (history.length >= 2) {
//         const sumResp = await this.groq.chat.completions.create({
//           model: 'llama-3.1-8b-instant',
//           messages: [
//             {
//               role: 'system',
//               content: 'Summarize this call in one short sentence.',
//             },
//             {
//               role: 'user',
//               content: history.map((h) => `${h.role}: ${h.content}`).join('\n'),
//             },
//           ],
//         });
//         dbSummary = sumResp.choices[0]?.message?.content || dbSummary;
//       }

//       await this.callsService.saveCall({
//         businessId: 'trt-international',
//         patientPhone: phoneNumber,
//         callSid: sid,
//         summary: dbSummary,
//         transcript: history.map((h) => `${h.role}: ${h.content}`).join('\n'),
//         status: status,
//         procedure: 'Logistics Inquiry',
//       });

//       console.log(`✅ DB Updated: ${status} for ${phoneNumber}`);
//     } catch (e) {
//       console.error('❌ DB Save failed:', e.message);
//     }
//   }

//   private async handleNotifications(
//     procedure: string,
//     timeStr: string,
//     userText: string,
//   ) {
//     try {
//       await sgMail.send({
//         to: 'nazarovkanat7@gmail.com',
//         from: 'kanatnazarov.dev@gmail.com',
//         subject: `Transcript of conversation: ${procedure}`,
//         html: `<p>New transcript for <b>${timeStr}</b>.</p><p>Last user text: ${userText}</p>`,
//       });
//     } catch (err) {
//       console.error('❌ Email Failed');
//     }
//   }
//   private async createCalendarEvent(procedure: string, finalStartTime: string) {
//     const calendarId =
//       '6d380c70c92967c126387dba5367621b336c78f49a26e5ab7cfeaa7a99d6bc33@group.calendar.google.com';

//     const event = {
//       summary: `${procedure || 'Conversation'}`,
//       description: `AI Lead via Fusion AI Agency`,
//       start: { dateTime: finalStartTime, timeZone: 'America/New_York' },
//       end: {
//         dateTime: new Date(
//           new Date(finalStartTime).getTime() + 60 * 60 * 1000,
//         ).toISOString(),
//         timeZone: 'America/New_York',
//       },
//       colorId: '6',
//     };

//     return await this.calendar.events.insert({
//       calendarId,
//       requestBody: event,
//     });
//   }
//   async speak(text: string): Promise<Buffer> {
//     try {
//       const response = await fetch(
//         `https://api.elevenlabs.io/v1/text-to-speech/PBZ6PhGMbBIzGFQBGF5u/stream?output_format=ulaw_8000&optimize_streaming_latency=4`,
//         {
//           method: 'POST',
//           headers: {
//             'xi-api-key': process.env.ELEVEN!,
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify({
//             text,
//             model_id: 'eleven_flash_v2_5',
//             voice_settings: {
//               stability: 0.2,
//               similarity_boost: 0.75,
//               speed_boost: true,
//             },
//           }),
//         },
//       );

//       if (!response.ok) throw new Error('ElevenLabs Fetch Failed');

//       const arrayBuffer = await response.arrayBuffer();
//       return Buffer.from(arrayBuffer);
//     } catch (error) {
//       console.error('❌ TTS Failed, using silence fallback');
//       return Buffer.alloc(8000, 0);
//     }
//   }
//   //
//   getDeepgramLive() {
//     const dynamicKeywords = this.configStore.getKeywords();
//     return this.deepgram.listen.live({
//       model: 'nova-2',
//       language: 'en-US',
//       encoding: 'mulaw',
//       sample_rate: 8000,
//       interim_results: true,
//       smart_format: true,
//       endpointing: 100,
//       vad_events: true,
//       keywords: dynamicKeywords,
//     });
//   }
//   async getInitialGreeting(): Promise<string> {
//     const dynamicGreeting = this.configStore.getGreeting();

//     console.log('🎙️ Sarah is starting with greeting:', dynamicGreeting);

//     return (
//       dynamicGreeting || 'Hello, this is Sarah with TRT. How can I help you?'
//     );
//   }
// }
// this is test version which will be for next



import { Injectable, OnModuleInit } from '@nestjs/common';
import { DeepgramClient, createClient } from '@deepgram/sdk';
import Groq from 'groq-sdk';
import { google } from 'googleapis';
import twilio from 'twilio';
import { TRT_LOGISTICS_KNOWLEDGE } from './clinic-info';
import { ElevenLabsClient } from 'elevenlabs';
import sgMail from '@sendgrid/mail';
import { CallsService } from 'src/calls/calls.service';
import { ConfigStore } from '../config/config';

@Injectable()
export class VoiceService implements OnModuleInit {
  private deepgram: DeepgramClient;
  private groq: Groq;
  private calendar;
  private twilioClient: twilio.Twilio;
  private elevenlabs: ElevenLabsClient;
  private lastAction = '';

  // ✅ REMOVED: Global properties like isLogging and currentCallSid have been entirely isolated
  private callMap = new Map<string, string>();
  private activeSessions = new Map<
    string,
    {
      isProcessing: boolean;
      phone: string;
      callStatus: string;
      isLogging: boolean; // 💡 FIXED: Track logging status uniquely per individual phone call session
    }
  >();

  constructor(
    private readonly callsService: CallsService,
    private readonly configStore: ConfigStore,
  ) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    this.elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVEN });
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    const credentialsGoogleCalendar = JSON.parse(
      process.env.GOOGLE_CREDS_JSON!,
    );
    const auth = new google.auth.GoogleAuth({
      keyFile: './google.json',
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  // 💡 FIXED: Avoid storing a single call's SID globally. Use activeSessions map tracking.
  setCurrentCallSid(sid: string) {
    if (!this.activeSessions.has(sid)) {
      this.activeSessions.set(sid, {
        isProcessing: false,
        phone: this.callMap.get(sid) || 'Unknown',
        callStatus: 'inquiry',
        isLogging: false,
      });
    }
    console.log(`🎯 Active tracking session validated for token: ${sid}`);
  }

  setCallerData(sid: string, phone: string) {
    this.callMap.set(sid, phone);

    this.activeSessions.set(sid, {
      isProcessing: false,
      phone: phone,
      callStatus: 'inquiry',
      isLogging: false, // 💡 Initialized tracking per session wrapper
    });
    console.log(`💾 Map & Fallback Updated: ${sid} -> ${phone}`);
  }

  async onModuleInit() {
    console.log('🚀 Fusion AI Backend Started.');
  }

  async makeOutboundCall(to: string) {
    try {
      const call = await this.twilioClient.calls.create({
        url: `https://${process.env.SERVER_URL}/calls/incoming-call`,
        to: to,
        from: '+19297022797',
        record: true,
        recordingStatusCallback: `https://${process.env.SERVER_URL}/calls/recording-callback`,
        recordingStatusCallbackMethod: 'POST',
      });
      console.log(`📞 Call initiated: ${call.sid}`);
    } catch (error) {
      console.error('❌ Call failed:', error);
    }
  }

  private readonly DEPARTMENTS = {
    sales: '+19177826487',
    dispatch: '+19177826487',
  };

  private getGroqTools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'transfer_to_department',
          description:
            'Transfers the caller to a specific department based on their need.',
          parameters: {
            type: 'object',
            properties: {
              dept: {
                type: 'string',
                enum: Object.keys(this.DEPARTMENTS),
                description: 'The department key to transfer to.',
              },
            },
            required: ['dept'],
          },
          required: ['dept'],
        },
      },
      {
        type: 'function',
        function: {
          name: 'schedule_logistics_consult',
          description:
            'Schedules a follow-up call with a logistics expert. ONLY call this if the user gives a specific time.',
          parameters: {
            type: 'object',
            properties: {
              cargoType: {
                type: 'string',
                description: 'Type of cargo (e.g. Oversize machinery, Vehicle)',
              },
              dateTime: {
                type: 'string',
                description: 'ISO 8601 format: YYYY-MM-DDTHH:mm:ss',
              },
            },
            required: ['cargoType', 'dateTime'],
          },
        },
      },
    ];
  }

  async generateResponse(
    userText: string,
    passedHistory: any[],
    onAudioData: (buffer: Buffer) => void,
    callSid: string,
  ) {
    if (!this.activeSessions.has(callSid)) {
      const backupPhone = this.callMap.get(callSid) || 'Unknown';
      this.activeSessions.set(callSid, {
        isProcessing: false,
        phone: backupPhone,
        callStatus: 'inquiry',
        isLogging: false,
      });
    }
    const session = this.activeSessions.get(callSid)!;

    if (session.isProcessing) return '';
    session.isProcessing = true;

    const dynamicKnowledge = this.configStore.getKnowledge();
    const dynamicSystemPrompt = this.configStore.getVoicePrompt();
    const leanHistory = passedHistory.slice(-10);
    const now = new Date();

    const nyTime = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    try {
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `\n            # REAL-TIME CLOCK\nCurrent NYC time: ${nyTime}\n${dynamicSystemPrompt}\n# KNOWLEDGE\n${dynamicKnowledge}\n`,
          },
          ...leanHistory,
        ],
        tools: this.getGroqTools() as any,
        tool_choice: 'auto',
        temperature: 0.7,
        stream: true,
      });

      let fullContent = '';
      let sentenceBuffer = '';
      let speechQueue = Promise.resolve();
      const fastFillers = [
        'got it',
        'sure thing',
        'i see',
        'great question',
        'sure',
      ];
      let firstChunkSent = false;
      let isTransferring = false;
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          sentenceBuffer += content;

          if (!firstChunkSent) {
            const currentBuffer = sentenceBuffer.toLowerCase().trim();
            const matchingFiller = fastFillers.find((f) =>
              currentBuffer.startsWith(f),
            );

            if (matchingFiller) {
              const fillerToSpeak = matchingFiller;
              sentenceBuffer = sentenceBuffer
                .substring(matchingFiller.length)
                .trim();
              firstChunkSent = true;

              speechQueue = speechQueue.then(async () => {
                const audioBuffer = await this.speak(fillerToSpeak);
                onAudioData(audioBuffer);
                console.log(`⚡ INSTANT FILLER: ${fillerToSpeak}`);
              });
            }
          }

          if (/[.!?]/.test(content)) {
            const trimmedBuffer = sentenceBuffer.trim();
            const isTitle = /\b(dr|mr|ms|mrs|st)\.$/i.test(trimmedBuffer);

            if (trimmedBuffer && !isTitle) {
              const speechOutput = trimmedBuffer;
              sentenceBuffer = '';
              firstChunkSent = true;

              speechQueue = speechQueue.then(async () => {
                const audioBuffer = await this.speak(speechOutput);
                onAudioData(audioBuffer);
                console.log(`🔊 Sent to Voice: ${speechOutput}`);
              });
            }
          }
        }

        const toolCall = chunk.choices[0]?.delta?.tool_calls?.[0];
        if (toolCall?.function?.name === 'transfer_to_department') {
          const args = JSON.parse(toolCall.function.arguments || '{}');
          const targetDept = args.dept;
          const targetNumber = this.DEPARTMENTS[targetDept];

          if (targetNumber && !isTransferring) {
            isTransferring = true;
            console.log(
              `🔀 Sarah routing individual line ${callSid} to ${targetDept}: ${targetNumber}`,
            );

            this.executeTransfer(callSid, targetNumber).catch((err) =>
              console.error(`❌ Delayed Transfer Failure for ${callSid}:`, err),
            );

            fullContent = `One moment, I'm connecting you to our ${targetDept.replace('_', ' ')} team.`;
          }
        }
      }
      if (isTransferring) {
        return fullContent;
      }
      if (sentenceBuffer.trim()) {
        const finalText = sentenceBuffer.trim();
        speechQueue = speechQueue.then(async () => {
          const audioBuffer = await this.speak(finalText);
          onAudioData(audioBuffer);
          console.log(`🔊 Final Chunk Sent: ${finalText}`);
        });
      }

      return fullContent;
    } catch (err) {
      console.error('❌ Groq/Streaming Error:', err);
      return "I'm having a bit of trouble with my connection. Could you repeat that?";
    } finally {
      session.isProcessing = false;
    }
  }

  async generateTextOnlyResponse(userText: string, passedHistory: any[]) {
    const dynamicKnowledge = this.configStore.getKnowledge();
    const dynamicSystemChatPrompt = this.configStore.getChatPrompt();
    const leanHistory = passedHistory.slice(-10);

    try {
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `\n# ROLE\nYou are Sarah, a Logistics Coordinator at TRT International. \n(Note: You are currently chatting via text on the website).\n\n${dynamicSystemChatPrompt}\n\n# KNOWLEDGE\n${dynamicKnowledge}\n`,
          },
          ...leanHistory,
          { role: 'user', content: userText },
        ],
        temperature: 0.7,
      });

      return (
        response.choices[0]?.message?.content ||
        "I'm sorry, I couldn't process that."
      );
    } catch (err) {
      console.error('❌ Groq Chat Error:', err);
      return "I'm having trouble connecting to my logistics database. Please try again in a moment.";
    }
  }

  async executeTransfer(sid: string, phoneNumber: string) {
    try {
      await this.twilioClient.calls(sid).update({
        url: `https://fusion-ai-bot.onrender.com/calls/transfer-dial?to=${encodeURIComponent(phoneNumber)}`,
        method: 'POST',
      });
    } catch (err) {
      console.error('❌ Transfer Failed:', err);
    }
  }

  async onCallDisconnect(finalHistory: any[], sid: string) {
    // Initialize standard session state wrapper if missing to execute lifecycle cleanup safely
    if (!this.activeSessions.has(sid)) {
      this.activeSessions.set(sid, {
        isProcessing: false,
        phone: this.callMap.get(sid) || 'Unknown',
        callStatus: 'inquiry',
        isLogging: false,
      });
    }

    const session = this.activeSessions.get(sid)!;

    // 💡 FIXED: Track log state locally per call context loop execution structure
    if (session.isLogging) return;
    session.isLogging = true;

    try {
      await this.logToDatabase('inquiry', sid, finalHistory);

      const transcriptString = finalHistory
        .map((h) => `<b>${h.role}:</b> ${h.content}`)
        .join('<br>');

      const phoneNumber = this.callMap.get(sid) || 'Unknown';
      await this.handleNotifications(
        `Inquiry (${phoneNumber})`,
        new Date().toLocaleString(),
        transcriptString,
      );
    } catch (error) {
      console.error(
        `❌ Error executing disconnection logging for ${sid}:`,
        error.message,
      );
    } finally {
      // 💡 FIXED: Guarantees resource collection drops memory traces even on downstream data failures
      this.activeSessions.delete(sid);
      this.callMap.delete(sid);
      console.log(
        `♻️ Concurrency Pipeline Purged for Session ${sid}. Resources completely recycled.`,
      );
    }
  }

  private async logToDatabase(status: string, sid: string, history: any[]) {
    try {
      // 💡 FIXED: Resolved undefined parameter reference compilation error safely
      const phoneNumber = this.callMap.get(sid) || 'Unknown';

      console.log(
        `💾 DB SAVE FINAL CHECK - SID: ${sid} | Found Phone: ${phoneNumber}`,
      );
      let dbSummary = 'Inquiry TRT';

      if (history.length >= 2) {
        const sumResp = await this.groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'Summarize this call in one short sentence.',
            },
            {
              role: 'user',
              content: history.map((h) => `${h.role}: ${h.content}`).join('\n'),
            },
          ],
        });
        dbSummary = sumResp.choices[0]?.message?.content || dbSummary;
      }

      await this.callsService.saveCall({
        businessId: 'trt-international',
        patientPhone: phoneNumber,
        callSid: sid,
        summary: dbSummary,
        transcript: history.map((h) => `${h.role}: ${h.content}`).join('\n'),
        status: status,
        procedure: 'Logistics Inquiry',
      });

      console.log(`✅ DB Updated: ${status} for ${phoneNumber}`);
    } catch (e) {
      console.error('❌ DB Save failed:', e.message);
    }
  }

  private async handleNotifications(
    procedure: string,
    timeStr: string,
    userText: string,
  ) {
    try {
      await sgMail.send({
        to: 'nazarovkanat7@gmail.com',
        from: 'kanatnazarov.dev@gmail.com',
        subject: `Transcript of conversation: ${procedure}`,
        html: `<p>New transcript for <b>${timeStr}</b>.</p><p>Last user text: ${userText}</p>`,
      });
    } catch (err) {
      console.error('❌ Email Failed');
    }
  }

  private async createCalendarEvent(procedure: string, finalStartTime: string) {
    const calendarId =
      '6d380c70c92967c126387dba5367621b336c78f49a26e5ab7cfeaa7a99d6bc33@group.calendar.google.com';

    const event = {
      summary: `${procedure || 'Conversation'}`,
      description: `AI Lead via Fusion AI Agency`,
      start: { dateTime: finalStartTime, timeZone: 'America/New_York' },
      end: {
        dateTime: new Date(
          new Date(finalStartTime).getTime() + 60 * 60 * 1000,
        ).toISOString(),
        timeZone: 'America/New_York',
      },
      colorId: '6',
    };

    return await this.calendar.events.insert({
      calendarId,
      requestBody: event,
    });
  }

  async speak(text: string): Promise<Buffer> {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/PBZ6PhGMbBIzGFQBGF5u/stream?output_format=ulaw_8000&optimize_streaming_latency=4`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.ELEVEN!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_flash_v2_5',
            voice_settings: {
              stability: 0.2,
              similarity_boost: 0.75,
              speed_boost: true,
            },
          }),
        },
      );

      if (!response.ok) throw new Error('ElevenLabs Fetch Failed');

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('❌ TTS Failed, using silence fallback');
      return Buffer.alloc(8000, 0);
    }
  }

  getDeepgramLive() {
    const dynamicKeywords = this.configStore.getKeywords();
    return this.deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      encoding: 'mulaw',
      sample_rate: 8000,
      interim_results: true,
      smart_format: true,
      endpointing: 100,
      vad_events: true,
      keywords: dynamicKeywords,
    });
  }

  async getInitialGreeting(): Promise<string> {
    const dynamicGreeting = this.configStore.getGreeting();
    console.log('🎙️ Sarah is starting with greeting:', dynamicGreeting);
    return (
      dynamicGreeting || 'Hello, this is Sarah with TRT. How can I help you?'
    );
  }
}
