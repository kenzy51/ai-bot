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
  private isProcessing = false;
  private elevenlabs: ElevenLabsClient;
  private lastAction = '';
  private callStatus: string = 'inquiry';
  private currentCallerPhone: string = ''; // Add this
  private isLogging = false;
  private currentCallSid: string = '';
  private callMap = new Map<string, string>();

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
  setCurrentCallSid(sid: string) {
    this.currentCallSid = sid;
  }
  setCallerData(sid: string, phone: string) {
    this.currentCallerPhone = phone;
    this.callMap.set(sid, phone);
    console.log(`💾 Map & Fallback Updated: ${sid} -> ${phone}`);
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
          name: 'transfer_to_sales',
          description:
            'Transfers the caller to a sales representative for a custom quote or account setup.',
          parameters: { type: 'object', properties: {} },
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
  ) {
    if (this.isProcessing) return '';
    this.isProcessing = true;
    const dynamicKnowledge = this.configStore.getKnowledge();
    const dynamicSystemPrompt = this.configStore.getPrompt();
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
    const isWeekday = [0, 1, 2, 3, 4].includes(now.getDay());
    try {
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `
            # REAL-TIME CLOCK
Current NYC time: ${nyTime}
${dynamicSystemPrompt}
# KNOWLEDGE
${dynamicKnowledge}
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
  // ONLY TEXT
  // Inside VoiceService class in voice.service.ts

  async generateTextOnlyResponse(userText: string, passedHistory: any[]) {
    const dynamicKnowledge = this.configStore.getKnowledge();
    const dynamicSystemPrompt = this.configStore.getPrompt();
    const leanHistory = passedHistory.slice(-10);

    try {
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `
# ROLE
You are Sarah, a Logistics Coordinator at TRT International. 
(Note: You are currently chatting via text on the website).

${dynamicSystemPrompt}

# KNOWLEDGE
${dynamicKnowledge}
`,
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
  async onCallDisconnect(finalHistory: any[], sid: string) {
    if (this.isLogging) return;
    this.isLogging = true;

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

    // 3. Clean up the map to prevent memory leaks
    this.callMap.delete(sid);

    this.currentCallSid = '';
    this.callStatus = 'inquiry';
    this.isLogging = false;
  }

  private async logToDatabase(status: string, sid: string, history: any[]) {
    try {
      let phoneNumber = this.callMap.get(sid);

      // 2. Emergency Fallback: If map fails, look for the most recent number set in the class
      if (!phoneNumber || phoneNumber === 'Unknown') {
        phoneNumber = this.currentCallerPhone || 'Unknown';
      }

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
  //
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
