"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService2 = void 0;
const common_1 = require("@nestjs/common");
const sdk_1 = require("@deepgram/sdk");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const googleapis_1 = require("googleapis");
const twilio_1 = __importDefault(require("twilio"));
const clinic_info_1 = require("./clinic-info");
const elevenlabs_1 = require("elevenlabs");
const mail_1 = __importDefault(require("@sendgrid/mail"));
const calls_service_1 = require("../../calls/calls.service");
let GeminiService2 = class GeminiService2 {
    callsService;
    deepgram;
    groq;
    calendar;
    twilioClient;
    isProcessing = false;
    elevenlabs;
    lastAction = '';
    chatHistory = [];
    callStatus = 'inquiry';
    isLogging = false;
    currentCallSid = '';
    constructor(callsService) {
        this.callsService = callsService;
        mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
        this.elevenlabs = new elevenlabs_1.ElevenLabsClient({ apiKey: process.env.ELEVEN });
        this.deepgram = (0, sdk_1.createClient)(process.env.DEEPGRAM_API_KEY);
        this.groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
        this.twilioClient = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const credentialsGoogleCalendar = JSON.parse(process.env.GOOGLE_CREDS_JSON);
        const auth = new googleapis_1.google.auth.GoogleAuth({
            keyFile: './google.json',
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        this.calendar = googleapis_1.google.calendar({ version: 'v3', auth });
    }
    setCurrentCallSid(sid) {
        this.currentCallSid = sid;
    }
    async onModuleInit() {
        console.log('🚀 Fusion AI Backend Started.');
    }
    async makeOutboundCall(to) {
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
        }
        catch (error) {
            console.error('❌ Call failed:', error);
        }
    }
    getGroqTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'transfer_call',
                    description: 'Transfers the caller to a human representative at the dental office.',
                    parameters: { type: 'object', properties: {} },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'book_appointment',
                    description: 'Schedules a dental appointment. ONLY call this if the user EXPLICITLY mentions a time AND day. NEVER call this for general questions, greetings, or unclear statements.',
                    parameters: {
                        type: 'object',
                        properties: {
                            procedure: {
                                type: 'string',
                                description: 'Type of treatment (e.g., NightLase)',
                            },
                            dateTime: {
                                type: 'string',
                                description: 'The date and time for the appointment in America/New_York (EST) timezone. Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss. Example: 2026-02-15T16:00:00',
                            },
                        },
                        required: ['procedure', 'dateTime'],
                    },
                },
            },
        ];
    }
    async generateResponse(userText, passedHistory, onAudioData) {
        if (this.isProcessing)
            return '';
        this.isProcessing = true;
        const leanHistory = passedHistory.slice(-10);
        this.chatHistory.push({ role: 'user', content: userText });
        if (this.chatHistory.length > 12)
            this.chatHistory.shift();
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
${clinic_info_1.CLINIC_KNOWLEDGE}`,
                    },
                    ...leanHistory,
                ],
                tools: this.getGroqTools(),
                tool_choice: 'auto',
                temperature: 0,
                stream: true,
            });
            let firstChunkSent = false;
            let fullContent = '';
            let sentenceBuffer = '';
            for await (const chunk of response) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullContent += content;
                    sentenceBuffer += content;
                    const words = sentenceBuffer.trim().split(' ');
                    if (/[.!?]/.test(content) || (!firstChunkSent && words.length > 7)) {
                        const textToSpeak = sentenceBuffer.trim();
                        if (textToSpeak) {
                            this.speak(textToSpeak).then((audioBuffer) => {
                                onAudioData(audioBuffer);
                            });
                            firstChunkSent = true;
                        }
                        sentenceBuffer = '';
                    }
                }
                const toolCall = chunk.choices[0]?.delta?.tool_calls?.[0];
                if (toolCall?.function?.name === 'transfer_call') {
                    await this.transferCall(this.currentCallSid);
                    return 'Transferring you now.';
                }
            }
            if (sentenceBuffer.trim()) {
                const finalChunk = sentenceBuffer.trim();
                this.speak(finalChunk).then((audioBuffer) => {
                    onAudioData(audioBuffer);
                    console.log(`🔊 Streaming final chunk: ${finalChunk}`);
                });
            }
            if (fullContent) {
                this.chatHistory.push({ role: 'assistant', content: fullContent });
            }
            this.isProcessing = false;
            return fullContent;
        }
        catch (err) {
            console.error('❌ Groq/Streaming Error:', err);
            return "I'm having a bit of trouble with my connection. Could you repeat that?";
        }
        finally {
            this.isProcessing = false;
        }
    }
    async transferCall(sid) {
        try {
            console.log(`🔀 Redirecting Call ${sid} to new Dial URL...`);
            await this.twilioClient.calls(sid).update({
                url: 'https://fusion-ai-bot.onrender.com/calls/transfer-dial',
                method: 'POST',
            });
        }
        catch (err) {
            console.error('❌ Twilio Transfer Error:', err);
        }
    }
    async onCallDisconnect() {
        if (this.isLogging)
            return;
        this.isLogging = true;
        const sidToLog = this.currentCallSid;
        await this.logToDatabase(this.callStatus, sidToLog);
        const transcriptString = this.chatHistory
            .map((h) => `<b>${h.role}:</b> ${h.content}`)
            .join('<br>');
        await this.handleNotifications('NightLase Inquiry', new Date().toLocaleString(), transcriptString);
        this.chatHistory = [];
        this.currentCallSid = '';
        this.callStatus = 'inquiry';
        this.isLogging = false;
    }
    async logToDatabase(status, sid) {
        try {
            let dbSummary = 'Inquiry about NightLase';
            if (this.chatHistory.length >= 2) {
                const sumResp = await this.groq.chat.completions.create({
                    model: 'llama-3.1-8b-instant',
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
        }
        catch (e) {
            console.error('❌ DB Save failed:', e.message);
        }
    }
    async handleNotifications(procedure, timeStr, userText) {
        try {
            await mail_1.default.send({
                to: 'pr@nytds.com',
                from: 'kanatnazarov.dev@gmail.com',
                subject: `Transwcipt of conversation: ${procedure}`,
                html: `<p>New transcript for <b>${timeStr}</b>.</p><p>Last user text: ${userText}</p>`,
            });
        }
        catch (err) {
            console.error('❌ Email Failed');
        }
    }
    async createCalendarEvent(procedure, finalStartTime) {
        const calendarId = '6d380c70c92967c126387dba5367621b336c78f49a26e5ab7cfeaa7a99d6bc33@group.calendar.google.com';
        const event = {
            summary: `Megan Booking: ${procedure || 'NightLase Eval'}`,
            description: `AI Lead via Fusion AI Agency`,
            start: { dateTime: finalStartTime, timeZone: 'America/New_York' },
            end: {
                dateTime: new Date(new Date(finalStartTime).getTime() + 60 * 60 * 1000).toISOString(),
                timeZone: 'America/New_York',
            },
            colorId: '6',
        };
        return await this.calendar.events.insert({
            calendarId,
            requestBody: event,
        });
    }
    async speak(text) {
        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/PBZ6PhGMbBIzGFQBGF5u/stream?output_format=ulaw_8000&optimize_streaming_latency=4`, {
                method: 'POST',
                headers: {
                    'xi-api-key': process.env.ELEVEN,
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
            });
            if (!response.ok)
                throw new Error('ElevenLabs Fetch Failed');
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        catch (error) {
            console.error('❌ TTS Failed, using silence fallback');
            return Buffer.alloc(8000, 0);
        }
    }
    getDeepgramLive() {
        return this.deepgram.listen.live({
            model: 'nova-2',
            language: 'en-US',
            encoding: 'mulaw',
            sample_rate: 8000,
            interim_results: true,
            smart_format: true,
            endpointing: 200,
            vad_events: true,
            keywords: ['NightLase:2', 'Fotona:2', 'Tribeca:1.5'],
        });
    }
    async getInitialGreeting() {
        return 'Hello, This is Jessica.I Am an AI assistant. We Received your request in Nightlase Treatment today. How can i help you?';
    }
};
exports.GeminiService2 = GeminiService2;
exports.GeminiService2 = GeminiService2 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [calls_service_1.CallsService])
], GeminiService2);
//# sourceMappingURL=gemini.service2.js.map