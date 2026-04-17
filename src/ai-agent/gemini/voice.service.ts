// this is test version which will be for next
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
export class VoiceService implements OnModuleInit {
  private deepgram: DeepgramClient;
  private groq: Groq;
  private calendar;
  private twilioClient: twilio.Twilio;
  private isProcessing = false;
  private elevenlabs: ElevenLabsClient;
  private lastAction = '';
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
  setCurrentCallSid(sid: string) {
    this.currentCallSid = sid;
  }
  async onModuleInit() {
    // await this.makeOutboundCall('+19297696545');
    console.log('🚀 Fusion AI Backend Started.');
  }

  async makeOutboundCall(to: string) {
    try {
      const call = await this.twilioClient.calls.create({
        url: `https://${process.env.SERVER_URL}/calls/incoming-call`,
        to: to,
        from: '+19297022797',
        // THIS IS THE KEY:
        record: true,
        recordingStatusCallback: `https://${process.env.SERVER_URL}/calls/recording-callback`,
        recordingStatusCallbackMethod: 'POST',
      });
      console.log(`📞 Call initiated: ${call.sid}`);
    } catch (error) {
      console.error('❌ Call failed:', error);
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

  async generateResponse(
    userText: string,
    passedHistory: any[],
    onAudioData: (buffer: Buffer) => void,
  ) {
    if (this.isProcessing) return '';
    this.isProcessing = true;
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
    const isWeekday = [0, 1, 2, 3, 4].includes(now.getDay()); // better than weekday string sometimes
    try {
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `
# ROLE
You are Jessica at Tribeca Dental Studio.

# REAL-TIME CLOCK (Critical)
Current NYC time: ${nyTime}
Is today a weekday? ${isWeekday ? 'YES' : 'NO'}

# OFFICE HOURS
- Monday to Friday: 8:00 AM – 6:00 PM
- Saturday & Sunday: 9:00 AM – 4:00 PM

# CURRENT STATUS
- If BEFORE closing time → We are **OPEN**
- If AFTER closing time → We are **CLOSED**

# AVAILABILITY RULES (Follow these strictly - highest priority)

When the user says they want to come "now", "in 10 minutes", "in one hour", "today", "as soon as possible", etc.:

- If we are currently OPEN:
  → Start with: "We're actually open right now."
  → Politely warn about closing time only if less than 2 hours left.
  → Example at 10:43 AM: "We're actually open right now. We close at 6:00 PM today, so you'd have to be fairly quick. Would you like to come in today or would tomorrow morning work better?"

- If we are CLOSED:
  → First sentence MUST be exactly: "Our office is actually closed right now as it's past 6:00 PM."

Never say "you'd have to be very fast" or "closing soon" when there are many hours left (e.g. at 10 AM or 11 AM).

# GENERAL RESPONSE RULES
- Always be friendly, professional and helpful.
- For any dental service question: Start with "Absolutely!" or "We certainly do!"
- After answering a non-airway question, gently pivot: "By the way, along with our standard care, we’re also checking all our patients' airways..."
- Always end your response with a question to keep the conversation going.
- Keep responses natural and conversational (not robotic). Do not make them extremely short.

# TOOL USE RULES
- Do NOT call 'transfer_call' or 'book_appointment' unless the user clearly wants to speak to a human or gives a specific date + time.
- For prices or specific treatments: Do not guess. Offer an evaluation.

# SALES MISSION (Airway Evaluation)
- We offer a Comprehensive Airway Evaluation (normally $750). New patients can get it for only $49 (must be prepaid).
- If interested: "I'll pass this to our team. They'll contact you shortly to send the patient forms."

# KNOWLEDGE
${CLINIC_KNOWLEDGE}
`,
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
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          sentenceBuffer += content;
          // 1. FAST FILLER TRIGGER (Smoother)
          const words = sentenceBuffer.trim().split(/\s+/);
          if (!firstChunkSent) {
            const currentBuffer = sentenceBuffer.toLowerCase().trim();

            // Check if the AI has started with one of our "clean" fillers
            const matchingFiller = fastFillers.find((f) =>
              currentBuffer.startsWith(f),
            );

            if (matchingFiller) {
              const fillerToSpeak = matchingFiller;
              // Remove the filler from the buffer so it's not repeated in the next chunk
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
              firstChunkSent = true; // Ensure we don't trigger the filler logic again

              speechQueue = speechQueue.then(async () => {
                const audioBuffer = await this.speak(speechOutput);
                onAudioData(audioBuffer);
                console.log(`🔊 Sent to Voice: ${speechOutput}`);
              });
            }
          }
        }
        const toolCall = chunk.choices[0]?.delta?.tool_calls?.[0];
        if (toolCall?.function?.name === 'transfer_call') {
          await this.transferCall(this.currentCallSid);
          return 'Transferring you now.';
        }
      }
      // TRICK
      if (sentenceBuffer.trim()) {
        const finalText = sentenceBuffer.trim();
        speechQueue = speechQueue.then(async () => {
          const audioBuffer = await this.speak(finalText);
          onAudioData(audioBuffer);
          console.log(`🔊 Final Chunk Sent: ${finalText}`);
        });
      }

      this.isProcessing = false; // Reset early

      return fullContent;
    } catch (err) {
      console.error('❌ Groq/Streaming Error:', err);
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
        // url: 'https://lesa-jovial-blushfully.ngrok-free.dev/calls/transfer-dial',
        url: 'https://fusion-ai-bot.onrender.com/calls/transfer-dial',
        method: 'POST',
      });
    } catch (err) {
      console.error('❌ Twilio Transfer Error:', err);
    }
  }
  async onCallDisconnect(finalHistory: any[]) {
    if (this.isLogging) return;
    this.isLogging = true;

    const sidToLog = this.currentCallSid;

    await this.logToDatabase(this.callStatus, sidToLog, finalHistory);

    const transcriptString = finalHistory
      .map((h) => `<b>${h.role}:</b> ${h.content}`)
      .join('<br>');

    await this.handleNotifications(
      'NightLase Inquiry',
      new Date().toLocaleString(),
      transcriptString,
    );

    // 3. Reset state
    this.currentCallSid = '';
    this.callStatus = 'inquiry';
    this.isLogging = false;
  }

  // HELPER: Handles DB Saving and Dynamic Summary
  private async logToDatabase(status: string, sid: string, history: any[]) {
    try {
      let dbSummary = 'Inquiry about NightLase';

      // Generate summary only if there's enough dialogue
      if (history.length >= 2) {
        const sumResp = await this.groq.chat.completions.create({
          model: 'llama-3.1-8b-instant', // Updated to current model
          messages: [
            {
              role: 'system',
              content: 'Summarize this dental call in one short sentence.',
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
        businessId: 'tribeca-dental-studio',
        patientPhone: '+19297696545',
        callSid: sid,
        summary: dbSummary,
        transcript: history.map((h) => `${h.role}: ${h.content}`).join('\n'),
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
        to: 'pr@nytds.com',
        from: 'kanatnazarov.dev@gmail.com',
        subject: `Transwcipt of conversation: ${procedure}`,
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
      model: 'nova-2',
      language: 'en-US',
      encoding: 'mulaw',
      sample_rate: 8000,
      interim_results: true,
      smart_format: true,
      endpointing: 100,
      vad_events: true,
      keywords: ['NightLase:2', 'Fotona:2', 'Tribeca:1.5'],
    });
  }

  async getInitialGreeting(): Promise<string> {
    return 'Hello, This is Jessica.Are you interested in Nightlase Treatment today. How can i help you?';
  }
}
