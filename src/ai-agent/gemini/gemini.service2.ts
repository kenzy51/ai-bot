
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DeepgramClient, createClient } from '@deepgram/sdk';
import Groq from 'groq-sdk';
import { google } from 'googleapis';
import twilio from 'twilio';
import { CLINIC_KNOWLEDGE } from './clinic-info';
import { ElevenLabsClient } from 'elevenlabs';
import sgMail from '@sendgrid/mail';
import { CallsService } from 'src/calls/calls.service';
@Injectable()
export class GeminiService implements OnModuleInit {
  private deepgram: DeepgramClient;
  private groq: Groq;
  private calendar;
  private twilioClient: twilio.Twilio;
  private isProcessing = false;
  private elevenlabs: ElevenLabsClient;
  private lastAction = '';
  private chatHistory: any[] = [];
  private callStatus: string = 'inquiry'; // Track the overall call status

  constructor(private readonly callsService: CallsService) {
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

  async onModuleInit() {
    await this.makeOutboundCall('+19297696545');
    console.log('🚀 Fusion AI Backend Started.');
  }

  async makeOutboundCall(to: string) {
    const ngrokUrl =
      'https://lesa-jovial-blushfully.ngrok-free.dev/leads/incoming-call';
    try {
      await this.twilioClient.calls.create({
        url: ngrokUrl,
        to: to,
        from: '+19297022797',
      });
      console.log(`📞 Calling: ${to}`);
    } catch (error) {
      console.error('❌ Twilio Error:', error);
    }
  }

  private getGroqTools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'book_appointment',
          description:
            'Schedules a dental appointment. ONLY call this if the user EXPLICITLY mentions a time AND day. NEVER call this for general questions, greetings, or unclear statements.',
          parameters: {
            type: 'object',
            properties: {
              procedure: {
                type: 'string',
                description: 'Type of treatment (e.g., NightLase)',
              },
              dateTime: {
                type: 'string',
                description:
                  'The date and time for the appointment in America/New_York (EST) timezone. Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss. Example: 2026-02-15T16:00:00',
              },
            },
            required: ['procedure', 'dateTime'],
          },
        },
      },
    ];
  }

  async generateResponse(userText: string) {
    if (this.isProcessing) return '';
    this.isProcessing = true;

    // 1. Manage Chat History - Keep it lean to save tokens and improve AI focus
    this.chatHistory.push({ role: 'user', content: userText });
    if (this.chatHistory.length > 12) this.chatHistory.shift();

    const now = new Date();
    const nyTime = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      // Use 8b model for speed and higher rate limits
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are Jessica, a specialist at Tribeca Dental Studio. 
        CURRENT TIME: ${nyTime}. 
            CRITICAL: If the user says something that does NOT contain a time or day, 
          DO NOT use the book_appointment tool. Answer the question instead.
            CONTEXT: The user is calling specifically about NightLase treatment. 
If they ask about "cost" or "how much", ALWAYS refer to the NightLase pricing in the knowledge base ($49 for evaluation). If they also ask what does it do, explain:
WHAT IT IS: A non-invasive, patient-friendly laser treatment for increasing the quality of a patient's sleep.
HOW IT WORKS: It uses gentle Fotona laser light to tighten the tissues at the back of the throat. This opens the airway and reduces the amplitude of snoring.
THE EXPERIENCE: No needles, no anesthesia, and no downtime. Patients can eat and drink immediately after.
COST: The initial concierge evaluation is just $49. The full treatment package pricing is discussed after the doctor determines the number of sessions needed.
            
            RULES:
            1. DO NOT say you have booked an appointment unless you call the 'book_appointment' tool.
            2. If the user is vague, ask for a specific time.
            3. Use the current time (${nyTime}) to calculate dates for "tomorrow" or specific days.
            4. Keep responses under 15 words.
5. NEVER call 'book_appointment' unless the user has explicitly provided BOTH a day and a specific time.
6. If the user asks about cost or details, answer from KNOWLEDGE, do NOT book an appointment.
7. If a tool call is missing 'dateTime', do NOT guess. Ask the user for the time instead.
8. If you have already booked an appointment in this conversation, do not book another one unless the user asks to change it.
9.Check always time with calendar to book an appointment.
10. If the user says "Thank you" or "Goodbye", acknowledge it and END the conversation. 
11. NEVER call 'book_appointment' in response to a "Thank you" or "Okay" after a booking is already confirmed.
STRICT FLOW:
1. INFORM: If the user is interested or asks "how much", explain NightLase: non-invasive laser for sleep/snoring, no needles, no downtime. Evaluation is $49.
2. QUALIFY: After explaining, ask if they would like to schedule that $49 evaluation.
3. BOOK: ONLY call 'book_appointment' if the user provides a SPECIFIC day and time (e.g., "Tomorrow at 4pm"). 

CRITICAL RULES:
- NEVER guess a time. If the user says "Yes" or "Okay" without a time, ask: "What day and time works best for your evaluation?"
- If the user asks about cost, answer "$49 for the evaluation" and do NOT book.
- Use ${nyTime} as your reference for "today".
- Keep responses under 15 words.
            KNOWLEDGE: ${CLINIC_KNOWLEDGE}`,
          },
          ...this.chatHistory,
        ],
        stream:true,
        tools: this.getGroqTools() as any,
        tool_choice: 'auto',
        temperature: 0,
      });
      // @ts-ignore
      const message = response.choices[0]?.message;
      let finalResponseText = message?.content || '';
      let currentStatus = 'inquiry'; // Default to inquiry for DB safety

      // --- TOOL CALLING LOGIC ---
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const args = JSON.parse(toolCall.function.arguments);

        if (toolCall.function.name === 'book_appointment') {
          const start = new Date(args.dateTime);
          // Auto-correct to current year if AI guesses wrong
          if (start.getFullYear() < 2026) start.setFullYear(2026);

          const startTimeISO = start.toISOString();

          // 1. Check Availability
          const existing = await this.calendar.events.list({
            calendarId:
              '6d380c70c92967c126387dba5367621b336c78f49a26e5ab7cfeaa7a99d6bc33@group.calendar.google.com',
            timeMin: startTimeISO,
            timeMax: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
            singleEvents: true,
          });

          if (existing.data.items.length > 0) {
            finalResponseText =
              'I just checked, and that slot is actually taken. Is there another time that works?';
          } else {
            // 2. Perform Booking
            await this.createCalendarEvent(args.procedure, startTimeISO);
            currentStatus = 'booked';
            this.callStatus = 'booked'; // Update overall status

            const options: Intl.DateTimeFormatOptions = {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            };
            const fullTimeStr = start.toLocaleString('en-US', options);
            finalResponseText = `Perfect! I've booked your evaluation for ${fullTimeStr}. We'll see you then!`;

            // 3. Send Notifications (Email to CEO)
            this.handleNotifications(args.procedure, fullTimeStr, userText);
          }
        }
      }

      // Record Megan's response to history
      if (finalResponseText) {
        this.chatHistory.push({
          role: 'assistant',
          content: finalResponseText,
        });
      }

      return finalResponseText;
    } catch (err) {
      console.error('❌ Groq/Logic Error:', err);
      return "I'm having a bit of trouble with my connection. Could you repeat that?";
    } finally {
      this.isProcessing = false;
    }
  }

  // NEW: Call this method when Twilio disconnects (e.g., from your CallsController or wherever the disconnect event is handled).
  // This ensures the full transcript is saved once at the end of the call, regardless of booking status.
  async onCallDisconnect() {
    await this.logToDatabase(this.callStatus);
  }

  // HELPER: Handles DB Saving and Dynamic Summary
  private async logToDatabase(status: string) {
    try {
      let dbSummary = 'Inquiry about NightLase';

      // Generate summary only if there's enough dialogue
      if (this.chatHistory.length >= 2) {
        const sumResp = await this.groq.chat.completions.create({
          model: 'llama-3.1-8b-instant', // Updated to current model
          messages: [
            {
              role: 'system',
              content: 'Summarize this dental call in one short sentence.',
            },
            {
              role: 'user',
              content: this.chatHistory
                .map((h) => `${h.role}: ${h.content}`)
                .join('\n'),
            },
          ],
        });
        dbSummary = sumResp.choices[0]?.message?.content || dbSummary;
      }

      await this.callsService.saveCall({
        businessId: 'tribeca-dental-studio',
        patientPhone: '+19297696545',
        summary: dbSummary,
        transcript: this.chatHistory
          .map((h) => `${h.role}: ${h.content}`)
          .join('\n'),
        status: status, // Correctly uses 'booked' or 'inquiry'
        procedure: 'NightLase',
      });
      console.log(`✅ DB Updated: ${status}`);
    } catch (e) {
      console.error('❌ DB Save failed:', e.message);
    }
  }

  // HELPER: Handles CEO Email
  private async handleNotifications(
    procedure: string,
    timeStr: string,
    userText: string,
  ) {
    try {
      await sgMail.send({
        to: 'kanatnazarov51@gmail.com',
        from: 'kanatnazarov.dev@gmail.com',
        subject: `✅ New Booking: ${procedure}`,
        html: `<p>New booking for <b>${timeStr}</b>.</p><p>Last user text: ${userText}</p>`,
      });
      console.log('📧 CEO Alert Sent');
    } catch (err) {
      console.error('❌ Email Failed');
    }
  }
  private async createCalendarEvent(procedure: string, finalStartTime: string) {
    const calendarId =
      '6d380c70c92967c126387dba5367621b336c78f49a26e5ab7cfeaa7a99d6bc33@group.calendar.google.com';

    const event = {
      summary: `Megan Booking: ${procedure || 'NightLase Eval'}`,
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
      const audioStream = await this.elevenlabs.textToSpeech.convert(
        'tMXujoAjiboschVOhAnk',
        { text, model_id: 'eleven_turbo_v2', output_format: 'ulaw_8000' },
      );

      const chunks = [];
      for await (const chunk of audioStream) {
        // @ts-ignore
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('❌ ElevenLabs Error:', error);
      throw error;
    }
  }

  getDeepgramLive() {
    return this.deepgram.listen.live({
      model: 'nova-2-medical',
      language: 'en-US',
      encoding: 'mulaw',
      sample_rate: 8000,
      interim_results: true,
      endpointing: 800,
      smart_format: true,
      vad_events: true, // Use Voice Activity Detection to stop listening when no one is talking
    });
  }

  async getInitialGreeting(): Promise<string> {
    return 'Hello, This is Jessica. We Received your request in Nightlase Treatment today. How can i help you today?';
  }
}




// import { Injectable, OnModuleInit } from '@nestjs/common';
// import { DeepgramClient, createClient } from '@deepgram/sdk';
// import Groq from 'groq-sdk';
// import { google } from 'googleapis';
// import twilio from 'twilio';
// import { CLINIC_KNOWLEDGE } from './clinic-info';
// import { ElevenLabsClient } from 'elevenlabs';
// import sgMail from '@sendgrid/mail';
// import { CallsService } from 'src/calls/calls.service';
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
//     await this.makeOutboundCall('+19297696545');
//     console.log('🚀 Fusion AI Backend Started.');
//   }

//   async makeOutboundCall(to: string) {
//     const ngrokUrl =
//       'https://lesa-jovial-blushfully.ngrok-free.dev/leads/incoming-call';
//     try {
//       await this.twilioClient.calls.create({
//         url: ngrokUrl,
//         to: to,
//         from: '+19297022797',
//       });
//       console.log(`📞 Calling: ${to}`);
//     } catch (error) {
//       console.error('❌ Twilio Error:', error);
//     }
//   }

//   private getGroqTools(): any[] {
//     return [
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

//   async generateResponse(userText: string) {
//     if (this.isProcessing) return '';
//     this.isProcessing = true;

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

//     try {
//       // Use 8b model for speed and higher rate limits
//       const response = await this.groq.chat.completions.create({
//         model: 'llama-3.1-8b-instant',
//         messages: [
//           {
//             role: 'system',
//             content: `You are Megan, a specialist at Tribeca Dental Studio.
//         CURRENT TIME: ${nyTime}.
//             CRITICAL: If the user says something that does NOT contain a time or day,
//           DO NOT use the book_appointment tool. Answer the question instead.
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
//         tools: this.getGroqTools() as any,
//         tool_choice: 'auto',
//         temperature: 0,
//       });

//       const message = response.choices[0]?.message;
//       let finalResponseText = message?.content || '';
//       let currentStatus = 'inquiry'; // Default to inquiry for DB safety

//       // --- TOOL CALLING LOGIC ---
//       if (message?.tool_calls && message.tool_calls.length > 0) {
//         const toolCall = message.tool_calls[0];
//         const args = JSON.parse(toolCall.function.arguments);

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

//       // --- MANDATORY LOGGING (Runs every turn, not just bookings) ---
//       // We don't await this so Megan can speak immediately while DB saves in background
//       this.logToDatabase(currentStatus);

//       return finalResponseText;
//     } catch (err) {
//       console.error('❌ Groq/Logic Error:', err);
//       return "I'm having a bit of trouble with my connection. Could you repeat that?";
//     } finally {
//       this.isProcessing = false;
//     }
//   }

//   // HELPER: Handles DB Saving and Dynamic Summary
//   private async logToDatabase(status: string) {
//     try {
//       let dbSummary = 'Inquiry about NightLase';

//       // Generate summary only if there's enough dialogue
//       if (this.chatHistory.length >= 2) {
//         const sumResp = await this.groq.chat.completions.create({
//           model: 'llama-3-8b-8192', // Use cheaper model for summary
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

//   async speak(text: string): Promise<Buffer> {
//     try {
//       const audioStream = await this.elevenlabs.textToSpeech.convert(
//         'tMXujoAjiboschVOhAnk',
//         { text, model_id: 'eleven_turbo_v2', output_format: 'ulaw_8000' },
//       );

//       const chunks = [];
//       for await (const chunk of audioStream) {
//         // @ts-ignore
//         chunks.push(chunk);
//       }
//       return Buffer.concat(chunks);
//     } catch (error) {
//       console.error('❌ ElevenLabs Error:', error);
//       throw error;
//     }
//   }

//   getDeepgramLive() {
//     return this.deepgram.listen.live({
//       model: 'nova-2-medical',
//       language: 'en-US',
//       encoding: 'mulaw',
//       sample_rate: 8000,
//       interim_results: true,
//       endpointing: 500,
//       smart_format: true,
//     });
//   }

//   async getInitialGreeting(): Promise<string> {
//     return 'Hello. This is Jessica. You requested about our NightLase treatment today. How can i Help?';
//   }
// }



















// // FUNNY TEST
// import { Injectable, OnModuleInit } from '@nestjs/common';
// import { DeepgramClient, createClient } from '@deepgram/sdk';
// import Groq from 'groq-sdk';
// import twilio from 'twilio';
// import { TECH_KNOWLEDGE } from './clinic-info';
// import { ElevenLabsClient } from 'elevenlabs';

// @Injectable()
// export class GeminiService implements OnModuleInit {
//   private deepgram: DeepgramClient;
//   private groq: Groq;
//   private twilioClient: twilio.Twilio;
//   private isProcessing = false;
//   private elevenlabs: ElevenLabsClient;

//   constructor() {
//     this.elevenlabs = new ElevenLabsClient({
//       apiKey: process.env.ELEVEN,
//     });
//     this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
//     this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
//     this.twilioClient = twilio(
//       process.env.TWILIO_ACCOUNT_SID,
//       process.env.TWILIO_AUTH_TOKEN,
//     );
//   }

//   async onModuleInit() {
//     console.log('🚀 Hustle Mode Started, Sir!');
//     await this.makeOutboundCall('+19293122624');
//   }

//   async makeOutboundCall(to: string) {
//     const ngrokUrl = 'https://lesa-jovial-blushfully.ngrok-free.dev/leads/incoming-call';
//     try {
//       await this.twilioClient.calls.create({
//         url: ngrokUrl,
//         to: to,
//         from: '+19297022797',
//       });
//       console.log(`📞 Calling potential victim, Sir: ${to}`);
//     } catch (error) {
//       console.error('❌ Twilio Error, Sir:', error);
//     }
//   }

//   async generateResponse(userText: string) {
//     if (this.isProcessing) return '';
//     this.isProcessing = true;

//     try {
//       const chatCompletion = await this.groq.chat.completions.create({
//         messages: [
//           {
//             role: 'system',
//             content: `You are John Smith, a high-speed iPhone hustler from New York.
//             You are trying to sell an iphone to Roki.
//             You have a shipment of iPhones from India and you need to move them NOW, Sir.

//             STRICT HUSTLE RULES:
//             1. **SSN DATA**: You must ask for their Social Security Number (SSN) immediately to "reserve" the phone, Sir. Don't wait, Sir!
//             2. **THE ORIGIN**: These are Exclusive India Editions with dual SIM, Sir. Best in the world, Sir.
//             3. **NO DENTISTRY**: You don't know what a dentist is, Sir. If they ask about teeth, tell them they need this iPhone camera to see how bad their teeth are, Sir!
//             4. **URGENCY**: Big Tony is around the corner with cash, Sir. They must give you their SSN and cash NOW, Sir.

//             KNOWLEDGE: ${TECH_KNOWLEDGE}
//             TONE: Aggressive, loud, fast-talking Mumbai-to-Manhattan style, Sir.`
//           },
//           { role: 'user', content: userText },
//         ],
//         model: 'llama-3.3-70b-versatile',
//         temperature: 0.8,
//       });

//       return chatCompletion.choices[0]?.message?.content || '';
//     } finally {
//       this.isProcessing = false;
//     }
//   }

//   async getInitialGreeting(): Promise<string> {
//     return "Hello, Roki! This is John Smith! I have the iPhone 17 India Edition for you! Give me your SSN right now so I can lock the price, Sir!";
//   }

//   async speak(text: string): Promise<Buffer> {
//   try {
//     // Убираем замедление через replace, чтобы не тратить миллисекунды
//     // Турбо-модель лучше всего работает с короткими фразами
//     console.log(`⚡ Generating lightning fast audio, Sir...`);

//     const audioStream = await this.elevenlabs.textToSpeech.convert(
//       "YmpzixbkOaQ7t3lmyaRe",
//       {
//         text: text, // Прямой текст без пауз для скорости
//         model_id: "eleven_turbo_v2", // Оставляем турбо, это критично
//         output_format: "ulaw_8000",
//         voice_settings: {
//           stability: 0.35, // Сэр, ставим низкую стабильность — это ускоряет старт генерации!
//           similarity_boost: 0.8,
//           style: 0.5, // Добавляем энергии
//           use_speaker_boost: true,
//         },
//       }
//     );

//     const chunks = [];
//     for await (const chunk of audioStream) {
//       // @ts-ignore
//       chunks.push(Buffer.from(chunk));
//     }

//     const buffer = Buffer.concat(chunks);
//     console.log(`✅ Ready to hustle, Sir! Size: ${buffer.length}`);
//     return buffer;

//   } catch (error) {
//     console.error('❌ ElevenLabs Speed Error, Sir:', error);
//     throw new Error('Hustle failed due to lag, Sir');
//   }
// }
//   getDeepgramLive() {
//     return this.deepgram.listen.live({
//       model: 'nova-2',
//       language: 'en-US',
//       encoding: 'mulaw',
//       sample_rate: 8000,
//       interim_results: true,
//       endpointing: 550,
//       smart_format: true,
//     });
//   }
// }
