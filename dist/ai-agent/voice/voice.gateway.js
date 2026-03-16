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
    streamSid = '';
    isGreetingSent = false;
    isDeepgramReady = false;
    constructor(geminiService) {
        this.geminiService = geminiService;
    }
    handleConnection(twilioWs) {
        console.log('🚀 Twilio connected to WebSocket');
        const dgLive = this.geminiService.getDeepgramLive();
        const sendAudioToTwilio = (base64Audio) => {
            if (!this.streamSid) {
                console.warn('⚠️ Cannot send audio: streamSid is missing');
                return;
            }
            twilioWs.send(JSON.stringify({
                event: 'media',
                streamSid: this.streamSid,
                media: { payload: base64Audio },
            }));
        };
        const attemptGreeting = async () => {
            if (this.isDeepgramReady && this.streamSid && !this.isGreetingSent) {
                this.isGreetingSent = true;
                try {
                    console.log('✨ System Ready. Generating initial greeting...');
                    const greetingText = await this.geminiService.getInitialGreeting();
                    const audioBuffer = await this.geminiService.speak(greetingText);
                    sendAudioToTwilio(audioBuffer.toString('base64'));
                    console.log('👋 Jessica sent initial greeting');
                }
                catch (err) {
                    console.error('🔴 Greeting Error:', err);
                }
            }
        };
        dgLive.on(sdk_1.LiveTranscriptionEvents.Open, () => {
            console.log('✅ Deepgram Connection Opened');
            this.isDeepgramReady = true;
            attemptGreeting();
        });
        dgLive.on(sdk_1.LiveTranscriptionEvents.Transcript, async (data) => {
            const transcript = data.channel.alternatives[0]?.transcript;
            if (transcript && transcript.trim().length > 2) {
                twilioWs.send(JSON.stringify({
                    event: 'clear',
                    streamSid: this.streamSid,
                }));
                if (!data.is_final)
                    return;
                console.log(`👤 User: ${transcript}`);
                try {
                    const aiResponse = await this.geminiService.generateResponse(transcript);
                    if (!aiResponse)
                        return;
                    console.log(`🤖 Jessica: ${aiResponse}`);
                    const audioBuffer = await this.geminiService.speak(aiResponse);
                    sendAudioToTwilio(audioBuffer.toString('base64'));
                }
                catch (err) {
                    console.error('🔴 AI Flow Error:', err);
                }
            }
        });
        twilioWs.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                switch (msg.event) {
                    case 'start':
                        this.streamSid = msg.start.streamSid;
                        console.log(`📞 Stream SID Captured: ${this.streamSid}`);
                        attemptGreeting();
                        break;
                    case 'media':
                        if (dgLive.getReadyState() === 1) {
                            const audioBuffer = Buffer.from(msg.media.payload, 'base64');
                            dgLive.send(new Uint8Array(audioBuffer));
                        }
                        break;
                    case 'stop':
                        console.log('⏹️ Call stopped by Twilio');
                        this.geminiService.onCallDisconnect();
                        if (dgLive.getReadyState() === 1)
                            dgLive.requestClose();
                        break;
                }
            }
            catch (error) {
                console.error('❌ Twilio Message Parse Error:', error);
            }
        });
        dgLive.on(sdk_1.LiveTranscriptionEvents.Error, (err) => console.error('🔴 DG Error:', err));
        twilioWs.dgLive = dgLive;
    }
    handleDisconnect(twilioWs) {
        console.log('❌ Twilio disconnected');
        this.geminiService.onCallDisconnect();
        const dgLive = twilioWs.dgLive;
        if (dgLive && dgLive.getReadyState() === 1) {
            dgLive.requestClose();
        }
    }
};
exports.VoiceGateway = VoiceGateway;
exports.VoiceGateway = VoiceGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        path: '/media-stream',
    }),
    __metadata("design:paramtypes", [gemini_service_1.GeminiService])
], VoiceGateway);
//# sourceMappingURL=voice.gateway.js.map