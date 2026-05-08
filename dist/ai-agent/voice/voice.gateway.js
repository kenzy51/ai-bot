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
const voice_service_1 = require("../gemini/voice.service");
const sdk_1 = require("@deepgram/sdk");
let VoiceGateway = class VoiceGateway {
    voiceService;
    constructor(voiceService) {
        this.voiceService = voiceService;
    }
    chatHistories = new Map();
    sessions = new Map();
    handleConnection(twilioWs) {
        let chatHistory = [];
        let streamSid = '';
        let callSid = '';
        let greetingStarted = false;
        const dgLive = this.voiceService.getDeepgramLive();
        this.chatHistories.set(twilioWs, chatHistory);
        const sendAudioToTwilio = (base64Audio) => {
            if (!streamSid)
                return;
            twilioWs.send(JSON.stringify({ event: 'media', streamSid, media: { payload: base64Audio } }));
        };
        const triggerGreeting = async () => {
            if (greetingStarted || !streamSid || dgLive.getReadyState() !== 1)
                return;
            greetingStarted = true;
            const greeting = await this.voiceService.getInitialGreeting();
            chatHistory.push({ role: 'assistant', content: greeting });
            const audio = await this.voiceService.speak(greeting);
            sendAudioToTwilio(audio.toString('base64'));
        };
        dgLive.on(sdk_1.LiveTranscriptionEvents.Transcript, async (data) => {
            const transcript = data.channel.alternatives[0]?.transcript;
            if (!data.is_final || !transcript || transcript.trim().length < 2)
                return;
            console.log(`👤 User: ${transcript}`);
            twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
            chatHistory.push({ role: 'user', content: transcript });
            const aiResponse = await this.voiceService.generateResponse(transcript, chatHistory, (audioBuffer) => {
                sendAudioToTwilio(audioBuffer.toString('base64'));
            });
            if (aiResponse) {
                chatHistory.push({ role: 'assistant', content: aiResponse });
                console.log(`🤖 Sarah: ${aiResponse}`);
            }
        });
        dgLive.on(sdk_1.LiveTranscriptionEvents.Open, () => {
            console.log('✅ Deepgram Socket Open');
            triggerGreeting();
        });
        dgLive.on(sdk_1.LiveTranscriptionEvents.Error, (err) => {
            console.error('❌ Deepgram Error:', err);
        });
        twilioWs.on('message', async (data) => {
            const msg = JSON.parse(data);
            if (msg.event === 'start') {
                streamSid = msg.start.streamSid;
                callSid = msg.start.callSid;
                this.sessions.set(twilioWs, callSid);
                this.voiceService.setCurrentCallSid(callSid);
                console.log(`📞 Call Started: ${callSid}`);
                triggerGreeting();
            }
            if (msg.event === 'media') {
                if (dgLive && dgLive.getReadyState() === 1) {
                    const audioPayload = msg.media.payload;
                    dgLive.send(Buffer.from(audioPayload, 'base64'));
                }
            }
            if (msg.event === 'stop') {
                console.log('🛑 Twilio stop event received');
                dgLive.requestClose();
            }
        });
    }
    async handleDisconnect(twilioWs) {
        console.log('❌ WebSocket Disconnected');
        const callSid = this.sessions.get(twilioWs);
        const history = this.chatHistories.get(twilioWs);
        if (callSid && history) {
            console.log(`📊 Finalizing Log for SID: ${callSid}`);
            await this.voiceService.onCallDisconnect(history, callSid);
            this.sessions.delete(twilioWs);
            this.chatHistories.delete(twilioWs);
        }
    }
};
exports.VoiceGateway = VoiceGateway;
exports.VoiceGateway = VoiceGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/media-stream' }),
    __metadata("design:paramtypes", [voice_service_1.VoiceService])
], VoiceGateway);
//# sourceMappingURL=voice.gateway.js.map