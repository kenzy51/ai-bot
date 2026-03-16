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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const gemini_service_1 = require("../gemini/gemini.service");
const sdk_1 = require("@deepgram/sdk");
let VoiceGateway = class VoiceGateway {
    geminiService;
    constructor(geminiService) {
        this.geminiService = geminiService;
    }
    isProcessingMap = new Map();
    handleConnection(twilioWs) {
        let streamSid = '';
        let chatHistory = [];
        let isDgReady = false;
        const dgLive = this.geminiService.getDeepgramLive();
        console.log('🔗 Attempting to connect to Deepgram...');
        dgLive.on(sdk_1.LiveTranscriptionEvents.Open, async () => {
            isDgReady = true;
            console.log('✅ Deepgram Ready, sending greeting...');
        });
        dgLive.on(sdk_1.LiveTranscriptionEvents.Error, (err) => {
            console.error('❌ Deepgram Error:', err);
        });
        dgLive.on(sdk_1.LiveTranscriptionEvents.Transcript, async (data) => {
            const transcript = data.channel.alternatives[0]?.transcript;
            if (!data.is_final || !transcript || transcript.trim().length < 3)
                return;
            if (this.isProcessingMap.get(streamSid))
                return;
            isDgReady = true;
            this.isProcessingMap.set(streamSid, true);
            twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
            chatHistory.push({ role: 'user', content: transcript });
            try {
                const aiResponse = await this.geminiService.generateResponse(transcript, chatHistory, twilioWs, streamSid);
                if (aiResponse)
                    chatHistory.push({ role: 'assistant', content: aiResponse });
            }
            finally {
                this.isProcessingMap.set(streamSid, false);
            }
        });
        twilioWs.on('message', async (data) => {
            const msg = JSON.parse(data);
            if (msg.event === 'start') {
                streamSid = msg.start.streamSid;
                const greeting = await this.geminiService.getInitialGreeting();
                await this.geminiService.streamTts(greeting, streamSid, twilioWs);
                chatHistory.push({ role: 'assistant', content: greeting });
            }
            if (msg.event === 'media') {
                if (dgLive.getReadyState() === 1) {
                    dgLive.send(Buffer.from(msg.media.payload, 'base64'));
                }
            }
        });
    }
    handleDisconnect(twilioWs) {
    }
};
exports.VoiceGateway = VoiceGateway;
exports.VoiceGateway = VoiceGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/media-stream' }),
    __metadata("design:paramtypes", [gemini_service_1.GeminiService])
], VoiceGateway);
//# sourceMappingURL=voice.gateway.js.map