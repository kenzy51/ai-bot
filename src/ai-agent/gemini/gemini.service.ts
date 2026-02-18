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

  constructor(private readonly callsService: CallsService) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    this.elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVEN });
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    const credentialsGoogleCalendar = JSON.parse(process.env.GOOGLE_CREDS_JSON!)
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsGoogleCalendar,
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
    this.chatHistory.push({ role: 'user', content: userText });
    const now = new Date();
    // CRITICAL: Feed the AI the exact current moment so it can calculate "tomorrow" correctly
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
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are Megan, a specialist at Tribeca Dental Studio. 
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
          { role: 'user', content: userText },
        ],
        tools: this.getGroqTools() as any,
        tool_choice: 'auto',
        temperature: 0, // Force logic over creativity
      });

      const message = response.choices[0]?.message;
      // response from assistant to make it remmeber what it said
      if (message?.content) {
        this.chatHistory.push({ role: 'assistant', content: message.content });
      }
      // --- TOOL CALLING LOGIC ---
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const lowerText = userText.toLowerCase();
        const hasTimeContext =
          lowerText.includes('am') ||
          lowerText.includes('pm') ||
          lowerText.includes("o'clock") ||
          lowerText.includes('tomorrow');

        if (!hasTimeContext && !lowerText.includes('book')) {
          console.log('🛑 Blocked accidental booking from text:', userText);
          return "I'm sorry, I didn't quite catch that. What day and time were you looking for?";
        }
        const toolCall = message.tool_calls[0];
        const args = JSON.parse(toolCall.function.arguments);
        if (toolCall.function.name === 'book_appointment') {
          const start = new Date(args.dateTime);
          console.log('AI Sent Date:', args.dateTime);
          if (start.getFullYear() < 2026) start.setFullYear(2026);

          const startTimeISO = start.toISOString();
          const endTimeISO = new Date(
            start.getTime() + 60 * 60 * 1000,
          ).toISOString();

          const existing = await this.calendar.events.list({
            calendarId:
              '6d380c70c92967c126387dba5367621b336c78f49a26e5ab7cfeaa7a99d6bc33@group.calendar.google.com',
            timeMin: startTimeISO,
            timeMax: endTimeISO,
            singleEvents: true,
          });

          if (existing.data.items.length > 0) {
            return 'I just checked, and that slot is actually taken. Is there another time that works?';
          }
          // 2. Perform Booking
          await this.createCalendarEvent(args.procedure, startTimeISO);
          this.lastAction = 'booked';

          // 1. Format the time for the CEO and Megan's speech
          const options: Intl.DateTimeFormatOptions = {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          };
          const fullTimeStr = start.toLocaleString('en-US', options);

          // 2. Generate a Dynamic AI Summary of the conversation
          let conversationSummary = 'No summary available.';
          try {
            const summaryResponse = await this.groq.chat.completions.create({
              model: 'llama-3.3-70b-versatile',
              messages: [
                {
                  role: 'system',
                  content:
                    "Summarize this dental booking call in one professional sentence for a clinic manager. Focus on the patient's main concern and the appointment time.",
                },
                {
                  role: 'user',
                  content: `Patient asked: ${userText}. The booking is for ${fullTimeStr} for the procedure ${args.procedure}.`,
                },
              ],
              temperature: 0.5,
            });
            conversationSummary =
              summaryResponse.choices[0]?.message?.content ||
              conversationSummary;
          } catch (e) {
            console.error('Summary failed, using default.');
          }

          // 3. Send the Professional Email to the CEO
          const customerPhone = '+19297696545';
          try {
            await sgMail.send({
              to: 'kanatnazarov51@gmail.com',
              from: 'kanatnazarov.dev@gmail.com',
              subject: `✅ New Booking: ${args.procedure} - ${start.toLocaleDateString()}`,
              html: `
            <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #2e7d32;">New Appointment Captured</h2>
                <p><strong>Procedure:</strong> ${args.procedure}</p>
                <p><strong>Time:</strong> ${fullTimeStr}</p>
                <p><strong>Patient Phone Number:</strong> ${customerPhone}</p>
                <div style="background: #f9f9f9; padding: 15px; border-left: 4px solid #2e7d32; margin-top: 20px;">
                    <strong>AI Summary:</strong><br/>
                    ${conversationSummary}
                </div>
                <p style="font-size: 12px; color: #888; margin-top: 20px;">Sent via Megan AI Receptionist</p>
            </div>
        `,
            });
            // saving call to database
            try {
              await this.callsService.saveCall({
                businessId: 'tribeca-dental-studio',
                patientPhone: customerPhone,
                summary: conversationSummary,
                transcript: this.chatHistory
                  .map((h) => `${h.role}: ${h.content}`)
                  .join('\n'),
                status: 'booked',
                procedure: args.procedure,
              });
              console.log('✅ Call History Saved to MongoDB');
            } catch (dbError) {
              console.error('❌ Failed to save call history:', dbError);
            }
            console.log('📧 CEO Alert Email Sent with Summary');
          } catch (error) {
            console.error('❌ Email Notification Failed:', error);
          }

          // 4. Megan's final confirmation to the patient
          return `Perfect! I've booked your evaluation for ${fullTimeStr}. We'll see you then!`;

          // BOOKING ENDS
        }
      }

      return message?.content || '';
    } catch (err) {
      console.error('❌ Groq Error:', err);
      return "I'm having trouble accessing my schedule. Could you say that time again?";
    } finally {
      this.isProcessing = false;
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
        'ghZGKuhcPR1A3D8yoBiM',
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
      endpointing: 500,
      smart_format: true,
    });
  }

  async getInitialGreeting(): Promise<string> {
    return 'Thank you for calling Tribeca Dental Studio. This is Kanat. Are you calling about our NightLase treatment today?';
  }
}

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
