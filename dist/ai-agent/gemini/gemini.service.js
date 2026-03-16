"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = void 0;
const common_1 = require("@nestjs/common");
const sdk_1 = require("@deepgram/sdk");
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const WebSocket = require("ws");
const clinic_info_1 = require("./clinic-info");
let GeminiService = class GeminiService {
    deepgram = (0, sdk_1.createClient)(process.env.DEEPGRAM_API_KEY);
    groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
    ttsSockets = new Map();
    async generateResponse(userText, history, twilioWs, streamSid) {
        const stream = await this.groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
                {
                    role: 'system',
                    content: `You are Jessica, a specialist at Tribeca Dental Studio. 
- YOU HAVE ALREADY GREETED THE USER. DO NOT GREET AGAIN.
- If the user asks about NightLase, explain it is a non-invasive laser treatment for snoring that uses Fotona laser light.
- Cost: $49 for the initial concierge evaluation.
- KEEP RESPONSES UNDER 20 WORDS.
- ONLY answer the user's specific question. Do not volunteer extra info.
  KNOWLEDGE: ${clinic_info_1.CLINIC_KNOWLEDGE}

`,
                },
                ...history,
            ],
            stream: true,
        });
        let fullText = '';
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                fullText += content;
                await this.streamTts(content, streamSid, twilioWs);
            }
        }
        return fullText;
    }
    async streamTts(text, streamSid, twilioWs) {
        let ws = this.ttsSockets.get(streamSid);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            ws = new WebSocket('wss://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000', {
                headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
            });
            this.ttsSockets.set(streamSid, ws);
            ws.on('message', (data) => {
                if (twilioWs.readyState === WebSocket.OPEN) {
                    twilioWs.send(JSON.stringify({
                        event: 'media',
                        streamSid,
                        media: { payload: data.toString('base64') },
                    }));
                }
            });
        }
        if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: 'Speak', text }));
    }
    async getInitialGreeting() {
        return "Hello, this is Jessica from Tribeca Dental Studio. I understand you're inquiring about NightLase treatment today. How can I help you with that?";
    }
    getDeepgramLive() {
        return this.deepgram.listen.live({
            model: 'nova-2',
            language: 'en-US',
            encoding: 'mulaw',
            sample_rate: 8000,
            interim_results: false,
            endpointing: 300,
        });
    }
    cleanup(streamSid) {
        const ws = this.ttsSockets.get(streamSid);
        if (ws) {
            ws.close();
            this.ttsSockets.delete(streamSid);
        }
    }
};
exports.GeminiService = GeminiService;
exports.GeminiService = GeminiService = __decorate([
    (0, common_1.Injectable)()
], GeminiService);
//# sourceMappingURL=gemini.service.js.map