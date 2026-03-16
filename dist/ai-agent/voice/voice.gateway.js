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
    handleConnection(twilioWs) {
        console.log('🚀 Twilio connected. Initializing fresh session.');
        let chatHistory = [];
        let streamSid = '';
        const dgLive = this.geminiService.getDeepgramLive();
        const sendAudioToTwilio = (base64Audio) => {
            if (!streamSid)
                return;
            twilioWs.send(JSON.stringify({
                event: 'media',
                streamSid,
                media: { payload: base64Audio },
            }));
        };
        dgLive.on(sdk_1.LiveTranscriptionEvents.Open, async () => {
            console.log('✅ Deepgram Ready');
            const greeting = await this.geminiService.getInitialGreeting();
            chatHistory.push({ role: 'assistant', content: greeting });
            const audio = await this.geminiService.speak(greeting);
            sendAudioToTwilio(audio.toString('base64'));
        });
        dgLive.on(sdk_1.LiveTranscriptionEvents.Transcript, async (data) => {
            const transcript = data.channel.alternatives[0]?.transcript;
            if (!data.is_final || !transcript || transcript.trim().length < 3)
                return;
            console.log(`👤 User: ${transcript}`);
            twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
            chatHistory.push({ role: 'user', content: transcript });
            const aiResponse = await this.geminiService.generateResponse(transcript, chatHistory);
            if (aiResponse) {
                chatHistory.push({ role: 'assistant', content: aiResponse });
                console.log(`🤖 Jessica: ${aiResponse}`);
                const audio = await this.geminiService.speak(aiResponse);
                sendAudioToTwilio(audio.toString('base64'));
            }
        });
        twilioWs.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.event === 'start')
                streamSid = msg.start.streamSid;
            if (msg.event === 'media' && dgLive.getReadyState() === 1) {
                dgLive.send(Buffer.from(msg.media.payload, 'base64'));
            }
            if (msg.event === 'stop')
                dgLive.requestClose();
        });
    }
    handleDisconnect() {
        console.log('❌ Call ended');
    }
};
exports.VoiceGateway = VoiceGateway;
exports.VoiceGateway = VoiceGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/media-stream' }),
    __metadata("design:paramtypes", [gemini_service_1.GeminiService])
], VoiceGateway);
//# sourceMappingURL=voice.gateway.js.map