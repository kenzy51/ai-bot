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
exports.GeminiService = void 0;
const common_1 = require("@nestjs/common");
const sdk_1 = require("@deepgram/sdk");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const googleapis_1 = require("googleapis");
const twilio_1 = __importDefault(require("twilio"));
const clinic_info_1 = require("./clinic-info");
const elevenlabs_1 = require("elevenlabs");
const mail_1 = __importDefault(require("@sendgrid/mail"));
const calls_service_1 = require("../../calls/calls.service");
let GeminiService = class GeminiService {
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
    async onModuleInit() {
        console.log('🚀 Fusion AI Backend Started.');
    }
    async makeOutboundCall(to) {
        const ngrokUrl = 'https://lesa-jovial-blushfully.ngrok-free.dev/leads/incoming-call';
        try {
            const call = await this.twilioClient.calls.create({
                url: ngrokUrl,
                to: to,
                from: '+19297022797',
                record: true,
                recordingStatusCallback: 'https://lesa-jovial-blushfully.ngrok-free.dev/calls/recording-callback',
                recordingStatusCallbackEvent: ['completed'],
            });
            this.currentCallSid = call.sid;
            console.log(`📞 Calling: ${to} | SID: ${call.sid}`);
        }
        catch (error) {
            console.error('❌ Twilio Error:', error);
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
    async generateResponse(userText, history) {
        if (this.isProcessing)
            return '';
        this.isProcessing = true;
        const messages = [...history, { role: 'user', content: userText }];
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
                        content: `You are Jessica, a specialist at Tribeca Dental Studio. 
        CURRENT TIME: ${nyTime}. 
            CRITICAL: If the user says something that does NOT contain a time or day, 

          DO NOT use the book_appointment tool. Answer the question instead.
          You are the voice agent. You have already greeted the user once. If the user says 'Hello' again, DO NOT repeat the full greeting. Simply say: 'Hi there, how can I help you with NightLase today?'
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
12. If the user seems frustrated, asks for a human, or if you have answered their initial questions, 
    ask: "Would you like to continue chatting with me, or shall I transfer you to our office staff?"
13. ONLY call 'transfer_call' if they explicitly say they want to be transferred or speak to a person.
STRICT FLOW:
1. INFORM: If the user is interested or asks "how much", explain NightLase: non-invasive laser for sleep/snoring, no needles, no downtime. Evaluation is $49.
2. QUALIFY: After explaining, ask if they would like to schedule that $49 evaluation.
3. BOOK: ONLY call 'book_appointment' if the user provides a SPECIFIC day and time (e.g., "Tomorrow at 4pm"). 

CRITICAL RULES:
- NEVER guess a time. If the user says "Yes" or "Okay" without a time, ask: "What day and time works best for your evaluation?"
- If the user asks about cost, answer "$49 for the evaluation" and do NOT book.
- Use ${nyTime} as your reference for "today".
- Keep responses under 15 words.
            KNOWLEDGE: ${clinic_info_1.CLINIC_KNOWLEDGE}`,
                    },
                    ...this.chatHistory,
                ],
                tools: this.getGroqTools(),
                tool_choice: 'auto',
                temperature: 0,
            });
            const message = response.choices[0]?.message;
            let finalResponseText = message?.content || '';
            let currentStatus = 'inquiry';
            if (message?.tool_calls && message.tool_calls.length > 0) {
                const toolCall = message.tool_calls[0];
                const args = JSON.parse(toolCall.function.arguments);
                if (toolCall.function.name === 'transfer_call') {
                    finalResponseText =
                        'Of course. Please hold one moment while I connect you to our office staff.';
                    setTimeout(() => {
                        this.transferCall(this.currentCallSid);
                    }, 4000);
                    this.callStatus = 'forwarded';
                }
                if (toolCall.function.name === 'book_appointment') {
                    const start = new Date(args.dateTime);
                    if (start.getFullYear() < 2026)
                        start.setFullYear(2026);
                    const startTimeISO = start.toISOString();
                    const existing = await this.calendar.events.list({
                        calendarId: '6d380c70c92967c126387dba5367621b336c78f49a26e5ab7cfeaa7a99d6bc33@group.calendar.google.com',
                        timeMin: startTimeISO,
                        timeMax: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
                        singleEvents: true,
                    });
                    if (existing.data.items.length > 0) {
                        finalResponseText =
                            'I just checked, and that slot is actually taken. Is there another time that works?';
                    }
                    else {
                        await this.createCalendarEvent(args.procedure, startTimeISO);
                        currentStatus = 'booked';
                        this.callStatus = 'booked';
                        const options = {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        };
                        const fullTimeStr = start.toLocaleString('en-US', options);
                        finalResponseText = `Perfect! I've booked your evaluation for ${fullTimeStr}. We'll see you then!`;
                        this.handleNotifications(args.procedure, fullTimeStr, userText);
                    }
                }
            }
            if (finalResponseText) {
                this.chatHistory.push({
                    role: 'assistant',
                    content: finalResponseText,
                });
            }
            return finalResponseText;
        }
        catch (err) {
            console.error('❌ Groq/Logic Error:', err);
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
                url: 'https://lesa-jovial-blushfully.ngrok-free.dev/calls/transfer-dial',
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
                to: 'kanatnazarov51@gmail.com',
                from: 'kanatnazarov.dev@gmail.com',
                subject: `✅ New Booking: ${procedure}`,
                html: `<p>New booking for <b>${timeStr}</b>.</p><p>Last user text: ${userText}</p>`,
            });
            console.log('📧 CEO Alert Sent');
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
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/PBZ6PhGMbBIzGFQBGF5u/stream?output_format=ulaw_8000`, {
                method: 'POST',
                headers: {
                    'xi-api-key': process.env.ELEVEN,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_turbo_v2',
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
            interim_results: false,
            endpointing: 300,
            smart_format: true,
        });
    }
    async getInitialGreeting() {
        return 'Hello, This is Jessica. We Received your request in Nightlase Treatment today. How can i help you today?';
    }
};
exports.GeminiService = GeminiService;
exports.GeminiService = GeminiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [calls_service_1.CallsService])
], GeminiService);
//# sourceMappingURL=gemini.service.js.map