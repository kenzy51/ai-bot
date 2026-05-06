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
exports.VoiceService = void 0;
const common_1 = require("@nestjs/common");
const sdk_1 = require("@deepgram/sdk");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const googleapis_1 = require("googleapis");
const twilio_1 = __importDefault(require("twilio"));
const elevenlabs_1 = require("elevenlabs");
const mail_1 = __importDefault(require("@sendgrid/mail"));
const calls_service_1 = require("../../calls/calls.service");
const config_1 = require("../config/config");
let VoiceService = class VoiceService {
    callsService;
    configStore;
    deepgram;
    groq;
    calendar;
    twilioClient;
    isProcessing = false;
    elevenlabs;
    lastAction = '';
    callStatus = 'inquiry';
    currentCallerPhone = '';
    isLogging = false;
    currentCallSid = '';
    callMap = new Map();
    constructor(callsService, configStore) {
        this.callsService = callsService;
        this.configStore = configStore;
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
    setCallerData(sid, phone) {
        this.callMap.set(sid, phone);
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
                    name: 'transfer_to_sales',
                    description: 'Transfers the caller to a sales representative for a custom quote or account setup.',
                    parameters: { type: 'object', properties: {} },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'schedule_logistics_consult',
                    description: 'Schedules a follow-up call with a logistics expert. ONLY call this if the user gives a specific time.',
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
    async generateResponse(userText, passedHistory, onAudioData) {
        if (this.isProcessing)
            return '';
        this.isProcessing = true;
        const dynamicKnowledge = this.configStore.getKnowledge();
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
# ROLE
You are Sarah, a Logistics Coordinator at TRT International.

# THE 3-SENTENCE RULE
1. Answer the user's specific question using the KNOWLEDGE BASE.
2. If the question is about pricing, tracking, or drop-offs, give the phone number: 973-344-7100.
3. End with a question like "Would you like me to transfer you to a specialist?" or "Do you have the container number handy?"

# CRITICAL CONSTRAINTS
- NEVER repeat the same fact twice in one call.
- Be concise. If the user is silent, do not keep talking.
- If you don't know a specific price, say: "Rates vary by route and cargo size. Let me get a sales manager on the line at extension 221 to give you an exact quote."
# REAL-TIME CLOCK
Current NYC time: ${nyTime}

# OFFICE HOURS
- Mon-Fri: 8:00 AM – 6:00 PM | Sat-Sun: 9:00 AM – 4:00 PM

# RESPONSE RULES
- Be professional, efficient, and knowledgeable about global shipping.
- For services: Start with "Absolutely, TRT handles that!" or "We specialize in exactly that."
- **Logistics Pivot**: After answering a general question, pivot to the quote: "To give you an accurate rate, would you like me to have a sales manager contact you for a custom quote?"
- Keep it conversational. Do not list everything at once unless asked.

# SALES MISSION
- Our goal is to collect shipment details (Port of Origin, Destination, Cargo Type).
- If they are ready for a quote: "I'll have our sales team reach out to you immediately to finalize the rates for your shipment."

# KNOWLEDGE
${dynamicKnowledge}
`,
                    },
                    ...leanHistory,
                ],
                tools: this.getGroqTools(),
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
                    const words = sentenceBuffer.trim().split(/\s+/);
                    if (!firstChunkSent) {
                        const currentBuffer = sentenceBuffer.toLowerCase().trim();
                        const matchingFiller = fastFillers.find((f) => currentBuffer.startsWith(f));
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
            if (sentenceBuffer.trim()) {
                const finalText = sentenceBuffer.trim();
                speechQueue = speechQueue.then(async () => {
                    const audioBuffer = await this.speak(finalText);
                    onAudioData(audioBuffer);
                    console.log(`🔊 Final Chunk Sent: ${finalText}`);
                });
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
    async onCallDisconnect(finalHistory, sid) {
        if (this.isLogging)
            return;
        this.isLogging = true;
        await this.logToDatabase('inquiry', sid, finalHistory);
        const transcriptString = finalHistory
            .map((h) => `<b>${h.role}:</b> ${h.content}`)
            .join('<br>');
        await this.handleNotifications('Inquiry', new Date().toLocaleString(), transcriptString);
        this.currentCallSid = '';
        this.callStatus = 'inquiry';
        this.isLogging = false;
    }
    async logToDatabase(status, sid, history) {
        try {
            let dbSummary = 'Inquiry TRT';
            const phoneNumber = this.callMap.get(sid) || 'Unknown';
            console.log(`💾 DB SAVE: Phone[${phoneNumber}] SID[${sid}]`);
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
            console.log(`✅ DB Updated: ${status}`);
        }
        catch (e) {
            console.error('❌ DB Save failed:', e.message);
        }
    }
    async handleNotifications(procedure, timeStr, userText) {
        try {
            await mail_1.default.send({
                to: 'nazarovkanat7@gmail.com',
                from: 'kanatnazarov.dev@gmail.com',
                subject: `Transcript of conversation: ${procedure}`,
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
            summary: `${procedure || 'Conversation'}`,
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
    async getInitialGreeting() {
        const dynamicGreeting = this.configStore.getGreeting();
        console.log('🎙️ Sarah is starting with greeting:', dynamicGreeting);
        return (dynamicGreeting || 'Hello, this is Sarah with TRT. How can I help you?');
    }
};
exports.VoiceService = VoiceService;
exports.VoiceService = VoiceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [calls_service_1.CallsService,
        config_1.ConfigStore])
], VoiceService);
//# sourceMappingURL=voice.service.js.map