// import { Injectable, OnModuleInit } from '@nestjs/common';
// import { DeepgramClient, createClient } from '@deepgram/sdk';
// import Groq from 'groq-sdk';
// import { google } from 'googleapis';
// import twilio from 'twilio';
// import { CLINIC_KNOWLEDGE } from './clinic-info';
// import { ElevenLabsClient } from 'elevenlabs';
// import sgMail from '@sendgrid/mail';
// import { CallsService } from 'src/calls/calls.service';
// // import * as WebSocket from 'ws'; // Use the ws package
// import WebSocket = require('ws');
// @Injectable()
// export class GeminiService implements OnModuleInit {
//   private deepgram: DeepgramClient;
//   private groq: Groq;
//   private calendar;
//   private twilioClient: twilio.Twilio;
//   private isProcessing = false;
//   private elevenlabs: ElevenLabsClient;
//   private lastAction = '';
//   private chatHistory: any[] = [];
//   private callStatus: string = 'inquiry';
//   private isLogging = false;
//   private currentCallSid: string = '';
//   private currentStreamSid: string = '';
//   private ttsSockets = new Map<string, WebSocket>();
//   private chatHistories = new Map<string, any[]>();
//   private isProcessingMap = new Map<string, boolean>();
//   constructor(private readonly callsService: CallsService) {
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

//   async onModuleInit() {
//     // await this.makeOutboundCall('+19297696545');
//     console.log('🚀 Fusion AI Backend Started.');
//   }

//   async makeOutboundCall(to: string) {
//     const ngrokUrl =
//       'https://lesa-jovial-blushfully.ngrok-free.dev/leads/incoming-call';
//     try {
//       const call = await this.twilioClient.calls.create({
//         url: ngrokUrl,
//         to: to,
//         from: '+19297022797',
//         record: true,
//         recordingStatusCallback:
//           'https://lesa-jovial-blushfully.ngrok-free.dev/calls/recording-callback',
//         recordingStatusCallbackEvent: ['completed'],
//       });
//       this.currentCallSid = call.sid;
//       console.log(`📞 Calling: ${to} | SID: ${call.sid}`);
//     } catch (error) {
//       console.error('❌ Twilio Error:', error);
//     }
//   }

//   private getGroqTools(): any[] {
//     return [
//       {
//         type: 'function',
//         function: {
//           name: 'transfer_call',
//           description:
//             'Transfers the caller to a human representative at the dental office.',
//           parameters: { type: 'object', properties: {} },
//         },
//       },
//       {
//         type: 'function',

//         function: {
//           name: 'book_appointment',
//           description:
//             'Schedules a dental appointment. ONLY call this if the user EXPLICITLY mentions a time AND day. NEVER call this for general questions, greetings, or unclear statements.',
//           parameters: {
//             type: 'object',
//             properties: {
//               procedure: {
//                 type: 'string',
//                 description: 'Type of treatment (e.g., NightLase)',
//               },
//               dateTime: {
//                 type: 'string',
//                 description:
//                   'The date and time for the appointment in America/New_York (EST) timezone. Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss. Example: 2026-02-15T16:00:00',
//               },
//             },
//             required: ['procedure', 'dateTime'],
//           },
//         },
//       },
//     ];
//   }

//   async generateResponse(
//     userText: string,
//     history: any[],
//     twilioWs: WebSocket,
//     streamSid: string,
//   ) {
//     if (this.isProcessing) return '';
//     this.isProcessing = true;
//     const messages = [...history, { role: 'user', content: userText }];
//     // 1. Manage Chat History - Keep it lean to save tokens and improve AI focus
//     this.chatHistory.push({ role: 'user', content: userText });
//     if (this.chatHistory.length > 12) this.chatHistory.shift();

//     const now = new Date();
//     const nyTime = now.toLocaleString('en-US', {
//       timeZone: 'America/New_York',
//       weekday: 'long',
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric',
//       hour: '2-digit',
//       minute: '2-digit',
//     });
//     let stream: any = null;
//     try {
//       // Use 8b model for speed and higher rate limits
//       const stream = await this.groq.chat.completions.create({
//         model: 'llama-3.1-8b-instant',
//         messages: [
//           {
//             role: 'system',
//             content: `You are Jessica, a specialist at Tribeca Dental Studio.
//         CURRENT TIME: ${nyTime}.
//             CRITICAL: If the user says something that does NOT contain a time or day,

//           DO NOT use the book_appointment tool. Answer the question instead.
//           You are the voice agent. You have already greeted the user once. If the user says 'Hello' again, DO NOT repeat the full greeting. Simply say: 'Hi there, how can I help you with NightLase today?'
//             CONTEXT: The user is calling specifically about NightLase treatment.
// If they ask about "cost" or "how much", ALWAYS refer to the NightLase pricing in the knowledge base ($49 for evaluation). If they also ask what does it do, explain:
// WHAT IT IS: A non-invasive, patient-friendly laser treatment for increasing the quality of a patient's sleep.
// HOW IT WORKS: It uses gentle Fotona laser light to tighten the tissues at the back of the throat. This opens the airway and reduces the amplitude of snoring.
// THE EXPERIENCE: No needles, no anesthesia, and no downtime. Patients can eat and drink immediately after.
// COST: The initial concierge evaluation is just $49. The full treatment package pricing is discussed after the doctor determines the number of sessions needed.

//             RULES:
//             1. DO NOT say you have booked an appointment unless you call the 'book_appointment' tool.
//             2. If the user is vague, ask for a specific time.
//             3. Use the current time (${nyTime}) to calculate dates for "tomorrow" or specific days.
//             4. Keep responses under 15 words.
// 5. NEVER call 'book_appointment' unless the user has explicitly provided BOTH a day and a specific time.
// 6. If the user asks about cost or details, answer from KNOWLEDGE, do NOT book an appointment.
// 7. If a tool call is missing 'dateTime', do NOT guess. Ask the user for the time instead.
// 8. If you have already booked an appointment in this conversation, do not book another one unless the user asks to change it.
// 9.Check always time with calendar to book an appointment.
// 10. If the user says "Thank you" or "Goodbye", acknowledge it and END the conversation.
// 11. NEVER call 'book_appointment' in response to a "Thank you" or "Okay" after a booking is already confirmed.
// 12. If the user seems frustrated, asks for a human, or if you have answered their initial questions,
//     ask: "Would you like to continue chatting with me, or shall I transfer you to our office staff?"
// 13. ONLY call 'transfer_call' if they explicitly say they want to be transferred or speak to a person.
// STRICT FLOW:
// 1. INFORM: If the user is interested or asks "how much", explain NightLase: non-invasive laser for sleep/snoring, no needles, no downtime. Evaluation is $49.
// 2. QUALIFY: After explaining, ask if they would like to schedule that $49 evaluation.
// 3. BOOK: ONLY call 'book_appointment' if the user provides a SPECIFIC day and time (e.g., "Tomorrow at 4pm").

// CRITICAL RULES:
// - NEVER guess a time. If the user says "Yes" or "Okay" without a time, ask: "What day and time works best for your evaluation?"
// - If the user asks about cost, answer "$49 for the evaluation" and do NOT book.
// - Use ${nyTime} as your reference for "today".
// - Keep responses under 15 words.
//             KNOWLEDGE: ${CLINIC_KNOWLEDGE}`,
//           },
//           ...this.chatHistory,
//         ],
//         stream: true,
//         tools: this.getGroqTools() as any,
//         tool_choice: 'auto',
//         temperature: 0,
//       });
//       // 2. Collect the stream into a single object
//       let fullResponse: any = null;
//       let fullText = '';
//       // @ts-ignore
//       for await (const chunk of stream) {
//         // Collect text for streaming (if you eventually add ElevenLabs streaming)
//         const content = chunk.choices[0]?.delta?.content;
//         if (content) {
//           fullText += content;
//           // This is the ONLY place audio should be triggered
//           await this.streamTts(content, streamSid, twilioWs);
//         }

//         // Collect the final choice object so we can read tool_calls later
//         if (
//           chunk.choices[0]?.finish_reason === 'stop' ||
//           chunk.choices[0]?.finish_reason === 'tool_calls'
//         ) {
//           fullResponse = chunk; // This is the completion object
//         }
//       }

//       // 3. Reconstruct what your existing code expects
//       // We map the collected data to the format your tools logic expects
//       const message = {
//         content: fullText,
//         tool_calls: fullResponse?.choices[0]?.delta?.tool_calls,
//       };

//       let finalResponseText = fullText;
//       let currentStatus = 'inquiry';
//       // --- TOOL CALLING LOGIC ---
//       if (message?.tool_calls && message.tool_calls.length > 0) {
//         const toolCall = message.tool_calls[0];
//         const args = JSON.parse(toolCall.function.arguments);
//         // call transferring
//         if (toolCall.function.name === 'transfer_call') {
//           finalResponseText =
//             'Of course. Please hold one moment while I connect you to our office staff.';

//           // Trigger the transfer AFTER sending the final verbal response
//           // We use a small timeout to ensure the AI finishes speaking the "transferring" message
//           setTimeout(() => {
//             this.transferCall(this.currentCallSid);
//           }, 4000); // 4 seconds gives the audio time to play

//           this.callStatus = 'forwarded'; // Update status for your DB
//         }
//         if (toolCall.function.name === 'book_appointment') {
//           const start = new Date(args.dateTime);
//           // Auto-correct to current year if AI guesses wrong
//           if (start.getFullYear() < 2026) start.setFullYear(2026);

//           const startTimeISO = start.toISOString();

//           // 1. Check Availability
//           const existing = await this.calendar.events.list({
//             calendarId:
//               '6d380c70c92967c126387dba5367621b336c78f49a26e5ab7cfeaa7a99d6bc33@group.calendar.google.com',
//             timeMin: startTimeISO,
//             timeMax: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
//             singleEvents: true,
//           });

//           if (existing.data.items.length > 0) {
//             finalResponseText =
//               'I just checked, and that slot is actually taken. Is there another time that works?';
//           } else {
//             // 2. Perform Booking
//             await this.createCalendarEvent(args.procedure, startTimeISO);
//             currentStatus = 'booked';
//             this.callStatus = 'booked'; // Update overall status

//             const options: Intl.DateTimeFormatOptions = {
//               weekday: 'long',
//               month: 'long',
//               day: 'numeric',
//               hour: '2-digit',
//               minute: '2-digit',
//             };
//             const fullTimeStr = start.toLocaleString('en-US', options);
//             finalResponseText = `Perfect! I've booked your evaluation for ${fullTimeStr}. We'll see you then!`;

//             // 3. Send Notifications (Email to CEO)
//             this.handleNotifications(args.procedure, fullTimeStr, userText);
//           }
//         }
//       }

//       // Record Megan's response to history
//       if (finalResponseText) {
//         this.chatHistory.push({
//           role: 'assistant',
//           content: finalResponseText,
//         });
//       }

//       return finalResponseText;
//     } catch (err) {
//       console.error('❌ Groq/Logic Error:', err);
//       return "I'm having a bit of trouble with my connection. Could you repeat that?";
//     } finally {
//       this.isProcessing = false;
//     }
//   }
//   // Add this method to GeminiService
//   async transferCall(sid: string) {
//     try {
//       console.log(`🔀 Redirecting Call ${sid} to new Dial URL...`);

//       await this.twilioClient.calls(sid).update({
//         url: 'https://lesa-jovial-blushfully.ngrok-free.dev/calls/transfer-dial',
//         method: 'POST',
//       });
//     } catch (err) {
//       console.error('❌ Twilio Transfer Error:', err);
//     }
//   }
//   // NEW: Call this method when Twilio disconnects (e.g., from your CallsController or wherever the disconnect event is handled).
//   // This ensures the full transcript is saved once at the end of the call, regardless of booking status.
//   async onCallDisconnect() {
//     if (this.isLogging) return; // Prevent double execution
//     this.isLogging = true;

//     const sidToLog = this.currentCallSid;
//     await this.logToDatabase(this.callStatus, sidToLog);

//     this.isLogging = false;
//   }

//   // HELPER: Handles DB Saving and Dynamic Summary
//   private async logToDatabase(status: string, sid: string) {
//     try {
//       let dbSummary = 'Inquiry about NightLase';

//       // Generate summary only if there's enough dialogue
//       if (this.chatHistory.length >= 2) {
//         const sumResp = await this.groq.chat.completions.create({
//           model: 'llama-3.1-8b-instant', // Updated to current model
//           messages: [
//             {
//               role: 'system',
//               content: 'Summarize this dental call in one short sentence.',
//             },
//             {
//               role: 'user',
//               content: this.chatHistory
//                 .map((h) => `${h.role}: ${h.content}`)
//                 .join('\n'),
//             },
//           ],
//         });
//         dbSummary = sumResp.choices[0]?.message?.content || dbSummary;
//       }

//       await this.callsService.saveCall({
//         businessId: 'tribeca-dental-studio',
//         patientPhone: '+19297696545',
//         callSid: sid,
//         summary: dbSummary,
//         transcript: this.chatHistory
//           .map((h) => `${h.role}: ${h.content}`)
//           .join('\n'),
//         status: status, // Correctly uses 'booked' or 'inquiry'
//         procedure: 'NightLase',
//       });
//       console.log(`✅ DB Updated: ${status}`);
//     } catch (e) {
//       console.error('❌ DB Save failed:', e.message);
//     }
//   }
//   private ttsWs: WebSocket | null | any = null;

//   async streamTts(text: string, streamSid: string, twilioWs: WebSocket) {
//     // Use a local variable to find or create the socket
//     let ws = this.ttsSockets.get(streamSid);

//     // 1. Initialize if it doesn't exist or is dead
//     if (!ws || ws.readyState !== WebSocket.OPEN) {
//       ws = new WebSocket(
//         'wss://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000',
//         {
//           headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
//         },
//       );

//       // Save it to the map immediately
//       this.ttsSockets.set(streamSid, ws);

//       ws.on('message', (data: Buffer) => {
//         if (twilioWs.readyState === WebSocket.OPEN) {
//           twilioWs.send(
//             JSON.stringify({
//               event: 'media',
//               streamSid,
//               media: { payload: data.toString('base64') },
//             }),
//           );
//         }
//       });

//       ws.on('error', (err) => console.error('❌ TTS WebSocket Error:', err));
//     }

//     // 2. Logic: Send using the 'ws' variable we just validated/created
//     if (ws.readyState === WebSocket.OPEN) {
//       ws.send(JSON.stringify({ type: 'Speak', text }));
//     } else if (ws.readyState === WebSocket.CONNECTING) {
//       ws.once('open', () => {
//         ws.send(JSON.stringify({ type: 'Speak', text }));
//       });
//     } else {
//       console.log('⚠️ WebSocket not ready. State:', ws.readyState);
//     }
//   }
//   // HELPER: Handles CEO Email
//   private async handleNotifications(
//     procedure: string,
//     timeStr: string,
//     userText: string,
//   ) {
//     try {
//       await sgMail.send({
//         to: 'kanatnazarov51@gmail.com',
//         from: 'kanatnazarov.dev@gmail.com',
//         subject: `✅ New Booking: ${procedure}`,
//         html: `<p>New booking for <b>${timeStr}</b>.</p><p>Last user text: ${userText}</p>`,
//       });
//       console.log('📧 CEO Alert Sent');
//     } catch (err) {
//       console.error('❌ Email Failed');
//     }
//   }
//   private async createCalendarEvent(procedure: string, finalStartTime: string) {
//     const calendarId =
//       '6d380c70c92967c126387dba5367621b336c78f49a26e5ab7cfeaa7a99d6bc33@group.calendar.google.com';

//     const event = {
//       summary: `Megan Booking: ${procedure || 'NightLase Eval'}`,
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

//   // async speak(text: string): Promise<Buffer> {
//   //   try {
//   //     const audioStream = await this.elevenlabs.textToSpeech.convert(
//   //       'PBZ6PhGMbBIzGFQBGF5u',
//   //       { text, model_id: 'eleven_turbo_v2', output_format: 'ulaw_8000' },
//   //     );

//   //     const chunks = [];
//   //     for await (const chunk of audioStream) {
//   //       // @ts-ignore
//   //       chunks.push(chunk);
//   //     }
//   //     return Buffer.concat(chunks);
//   //   } catch (error) {
//   //     console.error('❌ ElevenLabs Error:', error);
//   //     throw error;
//   //   }
//   // }
//   // async speak(text: string): Promise<Buffer> {
//   //   try {
//   //     const response = await fetch(
//   //       `https://api.elevenlabs.io/v1/text-to-speech/CaJGGnGTRWSly2yoC75U/stream?output_format=ulaw_8000`,
//   //       {
//   //         method: 'POST',
//   //         headers: {
//   //           'xi-api-key': process.env.ELEVEN!,
//   //           'Content-Type': 'application/json',
//   //         },
//   //         body: JSON.stringify({
//   //           text,
//   //           model_id: 'eleven_turbo_v2',
//   //           voice_settings: {
//   //             stability: 0.3, // LOWER stability = more emotional/faster variation
//   //             similarity_boost: 0.75,
//   //             speed_boost: true, // ADD THIS to enable the native speed multiplier
//   //           },
//   //         }),
//   //       },
//   //     );

//   //     if (!response.ok) throw new Error('ElevenLabs Fetch Failed');

//   //     const arrayBuffer = await response.arrayBuffer();
//   //     return Buffer.from(arrayBuffer);
//   //   } catch (error) {
//   //     console.error('❌ TTS Failed, using silence fallback');
//   //     return Buffer.alloc(8000, 0); // Returns 1 second of "mu-law silence" to prevent crashes
//   //   }
//   // }

//   getDeepgramLive() {
//     return this.deepgram.listen.live({
//       // model: 'nova-2-medical',
//       // language: 'en-US',
//       // encoding: 'mulaw',
//       // sample_rate: 8000,
//       // interim_results: true,
//       // endpointing: 800,
//       // smart_format: true,
//       // vad_events: true, // Use Voice Activity Detection to stop listening when no one is talking
//       model: 'nova-2', // Try switching from 'nova-2-medical' to 'nova-2' to test if it's a model-access issue
//       language: 'en-US',
//       encoding: 'mulaw',
//       sample_rate: 8000,
//       interim_results: true, // Set to false to reduce WebSocket traffic unless you specifically need real-time captions
//       endpointing: 500, // Faster endpointing for better response feel
//       smart_format: true,
//       vad_events: true, // CRITICAL: Listen for VAD events
//     });
//   }

//   async getInitialGreeting(): Promise<string> {
//     return 'Hello, This is Jessica. We Received your request in Nightlase Treatment today. How can i help you today?';
//   }
//   cleanup(streamSid: string) {
//     const ws = this.ttsSockets.get(streamSid);
//     if (ws) {
//       ws.close();
//       this.ttsSockets.delete(streamSid);
//     }
//     this.chatHistories.delete(streamSid);
//     this.isProcessingMap.delete(streamSid);
//   }
// }

import { Injectable } from '@nestjs/common';
import { createClient } from '@deepgram/sdk';
import Groq from 'groq-sdk';
import WebSocket = require('ws');
import { CLINIC_KNOWLEDGE } from './clinic-info';

@Injectable()
export class GeminiService {
  private deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  private groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  private ttsSockets = new Map<string, WebSocket>();

  async generateResponse(
    userText: string,
    history: any[],
    twilioWs: WebSocket,
    streamSid: string,
  ) {
    const stream = await this.groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          // Replace your system prompt with this strict version:
          content: `You are Jessica, a specialist at Tribeca Dental Studio. 
- YOU HAVE ALREADY GREETED THE USER. DO NOT GREET AGAIN.
- If the user asks about NightLase, explain it is a non-invasive laser treatment for snoring that uses Fotona laser light.
- Cost: $49 for the initial concierge evaluation.
- KEEP RESPONSES UNDER 20 WORDS.
- ONLY answer the user's specific question. Do not volunteer extra info.
  KNOWLEDGE: ${CLINIC_KNOWLEDGE}

`,
        },
        ...history,
      ],
      stream: true,
    });

    let fullText = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullText += content;
        await this.streamTts(content, streamSid, twilioWs);
      }
    }
    return fullText;
  }

  async streamTts(text: string, streamSid: string, twilioWs: WebSocket) {
    let ws = this.ttsSockets.get(streamSid);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      ws = new WebSocket(
        'wss://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000',
        {
          headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
        },
      );
      this.ttsSockets.set(streamSid, ws);
      ws.on('message', (data: Buffer) => {
        if (twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.send(
            JSON.stringify({
              event: 'media',
              streamSid,
              media: { payload: data.toString('base64') },
            }),
          );
        }
      });
    }
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: 'Speak', text }));
  }
  async getInitialGreeting(): Promise<string> {
    return "Hello, this is Jessica from Tribeca Dental Studio. I understand you're inquiring about NightLase treatment today. How can I help you with that?";
  }
  getDeepgramLive() {
    return this.deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      encoding: 'mulaw',
      sample_rate: 8000,
      interim_results: false,
      endpointing: 300,
    });
  }

  cleanup(streamSid: string) {
    const ws = this.ttsSockets.get(streamSid);
    if (ws) {
      ws.close();
      this.ttsSockets.delete(streamSid);
    }
  }
}
