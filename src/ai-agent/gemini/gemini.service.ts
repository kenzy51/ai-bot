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
  private callStatus: string = 'inquiry';
  private isLogging = false;
  private currentCallSid: string = '';
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
    // await this.makeOutboundCall('+19297696545');
    console.log('🚀 Fusion AI Backend Started.');
  }

  async makeOutboundCall(to: string) {
    const ngrokUrl =
      'https://lesa-jovial-blushfully.ngrok-free.dev/leads/incoming-call';
    try {
      const call = await this.twilioClient.calls.create({
        url: ngrokUrl,
        to: to,
        from: '+19297022797',
        record: true,
        recordingStatusCallback:
          'https://lesa-jovial-blushfully.ngrok-free.dev/calls/recording-callback',
        recordingStatusCallbackEvent: ['completed'],
      });
      this.currentCallSid = call.sid;
      console.log(`📞 Calling: ${to} | SID: ${call.sid}`);
    } catch (error) {
      console.error('❌ Twilio Error:', error);
    }
  }

  private getGroqTools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'transfer_call',
          description:
            'Transfers the caller to a human representative at the dental office.',
          parameters: { type: 'object', properties: {} },
        },
      },
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

  async generateResponse(userText: string, history: any[]) {
    if (this.isProcessing) return '';
    this.isProcessing = true;
    const messages = [...history, { role: 'user', content: userText }];
    // 1. Manage Chat History - Keep it lean to save tokens and improve AI focus
    this.chatHistory.push({ role: 'user', content: userText });
    if (this.chatHistory.length > 12) this.chatHistory.shift();
    const leanHistory = this.chatHistory.slice(-6);
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
            content: `
# ROLE
You are Jessica, a voice specialist at Tribeca Dental Studio. Time: ${nyTime}.

# CONTEXT (NightLase)
- **What**: Non-invasive Fotona laser to tighten throat tissue/reduce snoring.
- **Experience**: No needles, no anesthesia, no downtime.
- **Cost**: Concierge evaluation is $49. (Full plan discussed later).

# BOOKING PROTOCOL
- **Inform**: Explain NightLase & the $49 eval.
- **Qualify**: Ask to schedule ONLY if they show interest.
- **Book**: Call 'book_appointment' ONLY if a specific DAY and TIME (e.g., "Tuesday at 2pm") is provided.
- **Vague**: If time is missing, ask: "What day and time works best?" Never guess.

# VOICE RULES
- **Length**: Strict <15 words per response.
- **Greeting**: If they say 'Hello' again, say: "Hi there, how can I help you with NightLase today?"
- **Closing**: Acknowledge "Thank you/Goodbye" and end call.
- **Transfer**: If frustrated or asked, offer/call 'transfer_call'.

# KNOWLEDGE
${CLINIC_KNOWLEDGE}`,
          },
          ...leanHistory,
        ],
        tools: this.getGroqTools() as any,
        tool_choice: 'auto',
        temperature: 0,
      });
      const message = response.choices[0]?.message;
      let finalResponseText = message?.content || '';
      let currentStatus = 'inquiry'; // Default to inquiry for DB safety

      //
      // --- TOOL CALLING LOGIC ---
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const args = JSON.parse(toolCall.function.arguments);
        // call transferring
        if (toolCall.function.name === 'transfer_call') {
          finalResponseText =
            'Of course. Please hold one moment while I connect you to our office staff.';

          // Trigger the transfer AFTER sending the final verbal response
          // We use a small timeout to ensure the AI finishes speaking the "transferring" message
          setTimeout(() => {
            this.transferCall(this.currentCallSid);
          }, 4000); // 4 seconds gives the audio time to play

          this.callStatus = 'forwarded'; // Update status for your DB
        }
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
  // Add this method to GeminiService
  async transferCall(sid: string) {
    try {
      console.log(`🔀 Redirecting Call ${sid} to new Dial URL...`);

      await this.twilioClient.calls(sid).update({
        url: 'https://lesa-jovial-blushfully.ngrok-free.dev/calls/transfer-dial',
        method: 'POST',
      });
    } catch (err) {
      console.error('❌ Twilio Transfer Error:', err);
    }
  }
  // NEW: Call this method when Twilio disconnects (e.g., from your CallsController or wherever the disconnect event is handled).
  // This ensures the full transcript is saved once at the end of the call, regardless of booking status.
  async onCallDisconnect() {
    if (this.isLogging) return; // Prevent double execution
    this.isLogging = true;

    const sidToLog = this.currentCallSid;
    await this.logToDatabase(this.callStatus, sidToLog);

    this.isLogging = false;
  }

  // HELPER: Handles DB Saving and Dynamic Summary
  private async logToDatabase(status: string, sid: string) {
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
        callSid: sid,
        summary: dbSummary,
        transcript: this.chatHistory
          .map((h) => `${h.role}: ${h.content}`)
          .join('\n'),
        status: status,
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

  // async speak(text: string): Promise<Buffer> {
  //   try {
  //     const audioStream = await this.elevenlabs.textToSpeech.convert(
  //       'PBZ6PhGMbBIzGFQBGF5u',
  //       { text, model_id: 'eleven_turbo_v2', output_format: 'ulaw_8000' },
  //     );

  //     const chunks = [];
  //     for await (const chunk of audioStream) {
  //       // @ts-ignore
  //       chunks.push(chunk);
  //     }
  //     return Buffer.concat(chunks);
  //   } catch (error) {
  //     console.error('❌ ElevenLabs Error:', error);
  //     throw error;
  //   }
  // }

  async speak(text: string): Promise<Buffer> {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/PBZ6PhGMbBIzGFQBGF5u/stream?output_format=ulaw_8000&optimize_streaming_latency=3`,
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
              stability: 0.2, // LOWER stability = more emotional/faster variation
              similarity_boost: 0.75,
              speed_boost: true, // ADD THIS to enable the native speed multiplier
            },
          }),
        },
      );

      if (!response.ok) throw new Error('ElevenLabs Fetch Failed');

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('❌ TTS Failed, using silence fallback');
      return Buffer.alloc(8000, 0); // Returns 1 second of "mu-law silence" to prevent crashes
    }
  }
  //
  getDeepgramLive() {
    return this.deepgram.listen.live({
      // model: 'nova-2-medical',
      // language: 'en-US',
      // encoding: 'mulaw',
      // sample_rate: 8000,
      // interim_results: true,
      // endpointing: 800,
      // smart_format: true,
      // vad_events: true, // Use Voice Activity Detection to stop listening when no one is talking
      model: 'nova-2', // Try switching from 'nova-2-medical' to 'nova-2' to test if it's a model-access issue
      language: 'en-US',
      encoding: 'mulaw',
      sample_rate: 8000,
      interim_results: false, // Set to false to reduce WebSocket traffic unless you specifically need real-time captions
      endpointing: 300, // Faster endpointing for better response feel
      smart_format: true,
    });
  }

  async getInitialGreeting(): Promise<string> {
    return 'Hello, This is Jessica. We Received your request in Nightlase Treatment today. How can i help you today?';
  }
}
