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
exports.CallsController = void 0;
const common_1 = require("@nestjs/common");
const calls_service_1 = require("./calls.service");
const node_stream_1 = require("node:stream");
const voice_service_1 = require("../ai-agent/gemini/voice.service");
const twilio = require("twilio");
let CallsController = class CallsController {
    callsService;
    voiceService;
    client;
    constructor(callsService, voiceService) {
        this.callsService = callsService;
        this.voiceService = voiceService;
        this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    async handleIncoming(body, res) {
        const from = body.From;
        const sid = body.CallSid;
        if (from && sid) {
            await this.voiceService.setCallerData(sid, from);
        }
        const rawUrl = process.env.SERVER_URL || 'fusion-ai-bot.onrender.com';
        const cleanUrl = rawUrl.replace('https://', '').replace('http://', '');
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Recording 
      recordingStatusCallback="https://${rawUrl}/calls/recording-callback"
    />
  </Start>
  <Connect>
    <Stream url="wss://${cleanUrl}/media-stream" />
  </Connect>
</Response>`;
        res.set('Content-Type', 'text/xml');
        return res.status(200).send(twiml);
    }
    async getTransferDial(to, res) {
        const targetNumber = to || '+19177826487';
        const rawUrl = process.env.SERVER_URL || 'fusion-ai-bot.onrender.com';
        const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Say>One moment, connecting you to the department now.</Say>
    <Dial record="record-from-answer-dual" 
          recordingStatusCallback="${baseUrl}/calls/recording-callback" 
          callerId="+19297022797">
      <Number>${targetNumber}</Number>
    </Dial>
  </Response>`;
        res.set('Content-Type', 'text/xml');
        return res.status(200).send(twiml);
    }
    async handleRecordingCallback(body) {
        const { CallSid, RecordingUrl } = body;
        if (RecordingUrl && CallSid) {
            const directUrl = RecordingUrl.endsWith('.wav')
                ? RecordingUrl
                : `${RecordingUrl}.wav`;
            try {
                await this.callsService.updateCallRecording(CallSid, directUrl);
                console.log(`✅ Recording link synced: ${directUrl}`);
            }
            catch (error) {
                console.error('❌ DB Update Error:', error.message);
            }
        }
        return { status: 'ok' };
    }
    async streamRecording(url, res) {
        if (!url || url === 'undefined')
            return res.status(400).send('URL required');
        try {
            const response = await fetch(url, {
                headers: {
                    Authorization: 'Basic ' +
                        Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
                },
            });
            if (!response.ok)
                return res.status(response.status).send('Fetch failed');
            res.set({
                'Content-Type': 'audio/wav',
                'Transfer-Encoding': 'chunked',
                'Access-Control-Allow-Origin': '*',
            });
            if (response.body) {
                const body = node_stream_1.Readable.fromWeb(response.body);
                body.pipe(res);
            }
        }
        catch (error) {
            console.error('❌ Proxy Crash:', error.message);
        }
    }
    getClinicCalls(clinicId) {
        return this.callsService.getHistoryByBusiness(clinicId);
    }
};
exports.CallsController = CallsController;
__decorate([
    (0, common_1.Post)('incoming-call'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "handleIncoming", null);
__decorate([
    (0, common_1.Post)('transfer-dial'),
    __param(0, (0, common_1.Query)('to')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "getTransferDial", null);
__decorate([
    (0, common_1.Post)('recording-callback'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "handleRecordingCallback", null);
__decorate([
    (0, common_1.Get)('stream-recording'),
    __param(0, (0, common_1.Query)('url')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "streamRecording", null);
__decorate([
    (0, common_1.Get)(':clinicId'),
    __param(0, (0, common_1.Param)('clinicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "getClinicCalls", null);
exports.CallsController = CallsController = __decorate([
    (0, common_1.Controller)('calls'),
    __metadata("design:paramtypes", [calls_service_1.CallsService,
        voice_service_1.VoiceService])
], CallsController);
//# sourceMappingURL=calls.controller.js.map