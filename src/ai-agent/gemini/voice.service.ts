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
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant } from 'src/tenant/tenant.schema';
import { Call } from 'src/calls/schemas/call.schema';

@Injectable()
export class VoiceService implements OnModuleInit {
  private deepgram: DeepgramClient;
  private groq: Groq;
  private calendar;
  private twilioClient: twilio.Twilio;
  private elevenlabs: ElevenLabsClient;
  private lastAction = '';
  private callMap = new Map<string, string>();
  private activeSessions = new Map<
    string,
    {
      isProcessing: boolean;
      phone: string;
      callStatus: string;
      isLogging: boolean;
      tenantId: string;
    }
  >();

  constructor(
    private readonly callsService: CallsService,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
    @InjectModel(Call.name) private readonly callModel: Model<Call>,
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
  setCurrentCallSid(sid: string, tenantId: string) {
    // 🎯 ДОБАВЛЕНО: передаем tenantId
    if (!this.activeSessions.has(sid)) {
      const backupPhone = this.callMap.get(sid) || 'Unknown';
      this.activeSessions.set(sid, {
        isProcessing: false,
        phone: backupPhone,
        callStatus: 'inquiry',
        isLogging: false,
        tenantId: tenantId, // 🔒 Жестко привязываем резервный контекст к компании
      });
    }
    console.log(
      `🎯 Active tracking session validated for token: ${sid} [Tenant: ${tenantId}]`,
    );
  }
  getActiveSession(callSid: string) {
    return this.activeSessions.get(callSid);
  }

  async getTenantConfigById(tenantId: string) {
    return this.tenantModel.findById(tenantId).exec();
  }
  setCallerData(sid: string, phone: string, tenantId: string) {
    this.callMap.set(sid, phone);
    this.activeSessions.set(sid, {
      isProcessing: false,
      phone: phone,
      callStatus: 'inquiry',
      isLogging: false,
      tenantId: tenantId,
    });
    console.log(
      `🎯 [Multi-Tenant Session] Registered call ${sid} -> Client: ${tenantId}`,
    );
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
    const session = this.activeSessions.get(callSid);
    if (!session || session.isProcessing) return '';
    session.isProcessing = true;

    try {
      // 🔍 ШАГ 1: Извлекаем персональный конфиг из MongoDB на лету!
      const currentTenant = await this.tenantModel
        .findById(session.tenantId)
        .exec();
      if (!currentTenant) {
        throw new Error(`Tenant context lost for ID: ${session.tenantId}`);
      }

      const { voicePrompt, knowledgeBase, voiceId, departments } =
        currentTenant.voiceConfig;
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

      // 🔍 ШАГ 2: Скармливаем нейросети персональные инструкции и базу знаний клиента
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `# CLOCK\nCurrent NYC time: ${nyTime}\n\n${voicePrompt}\n\n# KNOWLEDGE DATABASE\n${knowledgeBase}\n`,
          },
          ...leanHistory,
        ],
        tools: this.getDynamicTools(departments) as any,
        tool_choice: 'auto',
        temperature: 0.4, // Снижаем температуру для высокой точности в коммерческих ответах
        stream: true,
      });

      let fullContent = '';
      let sentenceBuffer = '';
      let speechQueue = Promise.resolve();
      let isTransferring = false;

      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          sentenceBuffer += content;

          if (/[.!?]/.test(content)) {
            const trimmedBuffer = sentenceBuffer.trim();
            if (
              trimmedBuffer &&
              !/\b(dr|mr|ms|mrs|st)\.$/i.test(trimmedBuffer)
            ) {
              const speechOutput = trimmedBuffer;
              sentenceBuffer = '';

              speechQueue = speechQueue.then(async () => {
                // 🔊 Говорим персональным голосом этой компании
                const audioBuffer = await this.speak(speechOutput, voiceId);
                onAudioData(audioBuffer);
              });
            }
          }
        }

        // Динамический перевод звонка на номер конкретной компании
        const toolCall = chunk.choices[0]?.delta?.tool_calls?.[0];
        if (toolCall?.function?.name === 'transfer_to_department') {
          const args = JSON.parse(toolCall.function.arguments || '{}');
          const targetNumber = departments[args.dept];

          if (targetNumber && !isTransferring) {
            isTransferring = true;
            this.executeTransfer(callSid, targetNumber);
            fullContent = `One moment, connecting you now.`;
          }
        }
      }

      if (sentenceBuffer.trim()) {
        const finalText = sentenceBuffer.trim();
        speechQueue = speechQueue.then(async () => {
          const audioBuffer = await this.speak(finalText, voiceId);
          onAudioData(audioBuffer);
        });
      }

      return fullContent;
    } catch (err) {
      console.error('❌ Dynamic Response Engine Error:', err);
      return "I'm having a bit of trouble connecting to my database. Could you please repeat that?";
    } finally {
      session.isProcessing = false;
    }
  }

  // Динамические инструменты подгружают только отделы этой компании
  private getDynamicTools(departments: Record<string, string>): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'transfer_to_department',
          description:
            'Transfers the caller to a specific department internal phone line.',
          parameters: {
            type: 'object',
            properties: {
              dept: {
                type: 'string',
                enum: Object.keys(departments),
                description: 'The department key identifier.',
              },
            },
            required: ['dept'],
          },
        },
      },
    ];
  }
  async generateTextOnlyResponse(
    userText: string,
    passedHistory: any[],
    businessId: string,
  ) {
    const leanHistory = passedHistory.slice(-10);

    try {
      // 🔍 Ищем компанию в MongoDB по её ID или Slug, переданному из контроллера чата
      const currentTenant = await this.tenantModel
        .findOne({
          $or: [{ _id: businessId }, { slug: businessId }],
        })
        .exec();

      if (!currentTenant) {
        return 'System error: Tenant configuration node not found.';
      }

      // Вытаскиваем динамическую базу знаний и промпт конкретного чат-бота
      const dynamicKnowledge = currentTenant.voiceConfig.knowledgeBase;
      const dynamicSystemChatPrompt = currentTenant.voiceConfig.chatPrompt;

      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `${dynamicSystemChatPrompt}\n\n# KNOWLEDGE BASE\n${dynamicKnowledge}\n`,
          },
          ...leanHistory,
          { role: 'user', content: userText },
        ],
        temperature: 0.5, // Немного снижаем для большей точности ответов
      });

      return (
        response.choices[0]?.message?.content ||
        "I'm sorry, I couldn't process that response."
      );
    } catch (err) {
      console.error('❌ Groq Dynamic Chat Error:', err);
      return "I'm having trouble connecting to the systems database. Please try again in a moment.";
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
    // 💡 Если сессия уже удалена из памяти, берем tenantId из логов или ставим фоллбэк,
    // но объект должен строго соответствовать нашему новому типу с tenantId!
    if (!this.activeSessions.has(sid)) {
      const backupPhone = this.callMap.get(sid) || 'Unknown';
      this.activeSessions.set(sid, {
        isProcessing: false,
        phone: backupPhone,
        callStatus: 'inquiry',
        isLogging: false,
        tenantId: 'system-fallback', // 🔒 Обязательное поле для типизации, чтобы убрать ошибку ts(2345)
      });
    }

    const session = this.activeSessions.get(sid)!;

    if (session.isLogging) return;
    session.isLogging = true;

    try {
      // Передаем tenantId в метод логирования, чтобы звонок упал в нужную корзину компании
      await this.logToDatabase('inquiry', sid, finalHistory, session.tenantId);

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
      // Полная очистка ресурсов из памяти RAM
      this.activeSessions.delete(sid);
      this.callMap.delete(sid);
      console.log(
        `♻️ Concurrency Pipeline Purged for Session ${sid}. Resources completely recycled.`,
      );
    }
  }

  private async logToDatabase(
    status: string,
    sid: string,
    history: any[],
    tenantId: string,
  ) {
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
        tenantId: tenantId,
        callSid: sid,
        patientPhone: phoneNumber,
        summary: dbSummary,
        transcript: history.map((h) => `${h.role}: ${h.content}`).join('\n'),
        status: status,
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

  async speak(text: string, voiceId: string): Promise<Buffer> {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000&optimize_streaming_latency=4`,
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
              stability: 0.3,
              similarity_boost: 0.8,
              speed_boost: true,
            },
          }),
        },
      );

      if (!response.ok) throw new Error();
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      return Buffer.alloc(8000, 0);
    }
  }
  getDeepgramLive(keywords: string[] = []) {
    return this.deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      encoding: 'mulaw',
      sample_rate: 8000,
      interim_results: true,
      smart_format: true,
      endpointing: 100,
      vad_events: true,
      keywords: keywords,
    });
  }
}
