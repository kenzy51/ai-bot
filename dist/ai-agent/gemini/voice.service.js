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
        this.currentCallerPhone = phone;
        this.callMap.set(sid, phone);
        console.log(`💾 Map & Fallback Updated: ${sid} -> ${phone}`);
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
    DEPARTMENTS = {
        sales: '+19177826487',
        dispatch: '+19177826487',
    };
    getGroqTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'transfer_to_department',
                    description: 'Transfers the caller to a specific department based on their need.',
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
        const dynamicSystemPrompt = this.configStore.getVoicePrompt();
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
                if (toolCall?.function?.name === 'transfer_to_department') {
                    const args = JSON.parse(toolCall.function.arguments || '{}');
                    const targetDept = args.dept;
                    const targetNumber = this.DEPARTMENTS[targetDept];
                    if (targetNumber) {
                        console.log(`🔀 Sarah is routing call to ${targetDept}: ${targetNumber}`);
                        await this.executeTransfer(this.currentCallSid, targetNumber);
                        return `One moment, I'm connecting you to our ${targetDept.replace('_', ' ')} team.`;
                    }
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
    async generateTextOnlyResponse(userText, passedHistory) {
        const dynamicKnowledge = this.configStore.getKnowledge();
        const dynamicSystemChatPrompt = this.configStore.getChatPrompt();
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

${dynamicSystemChatPrompt}

# KNOWLEDGE
${dynamicKnowledge}
`,
                    },
                    ...leanHistory,
                    { role: 'user', content: userText },
                ],
                temperature: 0.7,
            });
            return (response.choices[0]?.message?.content ||
                "I'm sorry, I couldn't process that.");
        }
        catch (err) {
            console.error('❌ Groq Chat Error:', err);
            return "I'm having trouble connecting to my logistics database. Please try again in a moment.";
        }
    }
    async executeTransfer(sid, phoneNumber) {
        try {
            await this.twilioClient.calls(sid).update({
                url: `https://fusion-ai-bot.onrender.com/calls/transfer-dial?to=${encodeURIComponent(phoneNumber)}`,
                method: 'POST',
            });
        }
        catch (err) {
            console.error('❌ Transfer Failed:', err);
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
        const phoneNumber = this.callMap.get(sid) || 'Unknown';
        await this.handleNotifications(`Inquiry (${phoneNumber})`, new Date().toLocaleString(), transcriptString);
        this.callMap.delete(sid);
        this.currentCallSid = '';
        this.callStatus = 'inquiry';
        this.isLogging = false;
    }
    async logToDatabase(status, sid, history) {
        try {
            let phoneNumber = this.callMap.get(sid);
            if (!phoneNumber || phoneNumber === 'Unknown') {
                phoneNumber = this.currentCallerPhone || 'Unknown';
            }
            console.log(`💾 DB SAVE FINAL CHECK - SID: ${sid} | Found Phone: ${phoneNumber}`);
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