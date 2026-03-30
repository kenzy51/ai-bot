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
export class GeminiService2 implements OnModuleInit {
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
    history: any[],
    onAudioData: (buffer: Buffer) => void,
  ) {
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
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `
            # ROLE
You are Jessica, a AI specialist at Tribeca Dental Studio. Time: ${nyTime}.

# CONTEXT (NightLase)
- **What**: Non-invasive Fotona laser to tighten throat tissue/reduce snoring.
- **Experience**: No needles, no anesthesia, no downtime.
- **Cost**: Concierge evaluation is $49. (Full plan discussed later).
- **Names**: Also known as "sleep laser," "snoring treatment," or "airway tightening."
- **What**: Non-invasive Fotona laser... [rest of your prompt]

# BOOKING PROTOCOL
- **Inform**: Explain NightLase & the $49 eval.
- **Qualify**: Ask to schedule ONLY if they show interest.
- **Book**: Call 'book_appointment' ONLY if a specific DAY and TIME (e.g., "Tuesday at 2pm") is provided.
- **Vague**: If time is missing, ask: "What day and time works best?" Never guess.

# VOICE RULES
- **Length**: Strict <15 words per response.
- **Exception**: If asked about the "Team" or "Doctors", you may use up to 30 words to list the specialists from the KNOWLEDGE section.
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
        stream: true, // This triggered the error in your screenshot
      });

      let fullContent = '';
      let sentenceBuffer = '';

      // Iterate through the stream chunks to fix the 'choices' error
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';

        if (content) {
          fullContent += content;
          sentenceBuffer += content;

          // LATENCY OPTIMIZATION: If we hit a sentence end, speak it immediately
          if (
            /[.!?]/.test(content) &&
            !sentenceBuffer.toLowerCase().endsWith('dr.')
          ) {
            const textToSpeak = sentenceBuffer.trim();
            if (textToSpeak) {
              // We don't 'await' this so the loop can keep getting the next sentence
              // this.speak(textToSpeak).then((audioBuffer) => {
              //   // Logic to stream this audioBuffer to Twilio goes here
              //   console.log(`🔊 Speaking chunk: ${textToSpeak}`);
              // });
              this.speak(textToSpeak).then((audioBuffer) => {
                onAudioData(audioBuffer); // Send audio to Twilio RIGHT NOW
                console.log(`🔊 Streaming chunk: ${textToSpeak}`);
              });
            }
            sentenceBuffer = ''; // Clear buffer for next sentence
          }
        }

        // Handle tool calls in a stream (Simplified for stability)
        const toolCall = chunk.choices[0]?.delta?.tool_calls?.[0];
        if (toolCall?.function?.name === 'transfer_call') {
          await this.transferCall(this.currentCallSid);
          return 'Transferring you now.';
        }
      }
      // TRICK
      if (sentenceBuffer.trim()) {
        const finalChunk = sentenceBuffer.trim();
        this.speak(finalChunk).then((audioBuffer) => {
          onAudioData(audioBuffer);
          console.log(`🔊 Streaming final chunk: ${finalChunk}`);
        });
      }

      // Record the final combined response to history
      if (fullContent) {
        this.chatHistory.push({ role: 'assistant', content: fullContent });
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
      interim_results: true, // Set to false to reduce WebSocket traffic unless you specifically need real-time captions
      smart_format: true,
      endpointing: 300, // Reduced from 300; AI starts thinking 200ms after you stop
      utterance_end_ms: 1000, // Forces an end if there is a long pause
      vad_events: true,
      keywords: [
        'NightLase:2',
        'Fotona:2',
        'snoring:1.5',
        'concierge:1.2',
        'Tribeca:1.5',
      ],
      search: ['nightlase', 'fotona'], // Helps with "NightLase" recognition
    });
  }

  async getInitialGreeting(): Promise<string> {
    return 'Hello, This is Jessica.I Am an AI assistant. We Received your request in Nightlase Treatment today. How can i help you?';
  }
}
