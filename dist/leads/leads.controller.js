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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadsController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("../ai-agent/config/config");
const voice_service_1 = require("../ai-agent/gemini/voice.service");
const calls_service_1 = require("../calls/calls.service");
const twilio = require("twilio");
let LeadsController = class LeadsController {
    callsService;
    voiceService;
    configStore;
    client;
    constructor(callsService, voiceService, configStore) {
        this.callsService = callsService;
        this.voiceService = voiceService;
        this.configStore = configStore;
        this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    async handleIncomingCall(body) {
        const from = body.From;
        const sid = body.CallSid;
        if (from && sid) {
            this.voiceService.setCallerData(sid, from);
            try {
                await this.client.calls(sid).recordings.create({
                    recordingStatusCallback: `https://${process.env.SERVER_URL}/leads/recording-callback`,
                    recordingStatusCallbackMethod: 'POST',
                    trim: 'trim-silence',
                    playBeep: false
                });
                console.log(`✨ Background recording initiated for: ${sid}`);
            }
            catch (err) {
                console.error('❌ Failed to start background recording:', err.message);
            }
        }
        return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="wss://${process.env.SERVER_URL}/media-stream" />
      </Connect>
    </Response>`;
    }
    async updateConfig(body) {
        this.configStore.updateConfig(body.knowledge, body.keywords, body.greeting);
        console.log('✨ Sarah Updated: Knowledge + Keywords + Greeting');
        return { success: true };
    }
    async handleRecordingCallback(body) {
        console.log('--- TWILIO CALLBACK ARRIVED ---');
        console.log('Raw Body:', body);
        const url = body.RecordingUrl;
        const sid = body.CallSid;
        if (!url || !sid) {
            console.error('❌ Callback missing data:', { url, sid });
            return { status: 'missing_data' };
        }
        const finalUrl = `${url}.wav`;
        try {
            const updated = await this.callsService.updateCallRecording(sid, finalUrl);
            if (updated) {
                console.log(`✅ Database updated for SID: ${sid}`);
            }
            else {
                console.warn(`⚠️ No record found in DB for SID: ${sid}`);
            }
        }
        catch (error) {
            console.error('❌ DB Update Error:', error.message);
        }
        return { status: 'received' };
    }
    async getConfig() {
        return {
            knowledge: this.configStore.getKnowledge(),
            keywords: this.configStore.getKeywords().join(', '),
            greeting: this.configStore.getGreeting(),
        };
    }
};
exports.LeadsController = LeadsController;
__decorate([
    (0, common_1.Post)('incoming-call'),
    (0, common_1.Header)('Content-Type', 'text/xml'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "handleIncomingCall", null);
__decorate([
    (0, common_1.Post)('update-config'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Post)('recording-callback'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "handleRecordingCallback", null);
__decorate([
    (0, common_1.Get)('config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "getConfig", null);
exports.LeadsController = LeadsController = __decorate([
    (0, common_1.Controller)('leads'),
    __metadata("design:paramtypes", [calls_service_1.CallsService,
        voice_service_1.VoiceService,
        config_1.ConfigStore])
], LeadsController);
//# sourceMappingURL=leads.controller.js.map