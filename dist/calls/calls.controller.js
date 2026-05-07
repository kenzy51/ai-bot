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
    async handleIncomingCall(body) {
        const from = body.From || body.from;
        const sid = body.CallSid || body.callSid;
        console.log(`📞 RECEIVED CALL DATA - From: ${from}, SID: ${sid}`);
        if (from && sid) {
            await this.voiceService.setCallerData(sid, from);
            try {
                await this.client.calls(sid).recordings.create({
                    recordingStatusCallback: `https://${process.env.SERVER_URL}/calls/recording-callback`,
                    recordingStatusCallbackMethod: 'POST',
                    trim: 'trim-silence',
                });
                console.log(`✨ Recording triggered for SID: ${sid}`);
            }
            catch (err) {
                console.error('❌ Recording trigger failed:', err.message);
            }
        }
        else {
            console.warn('⚠️ WARNING: Incoming call arrived without From or CallSid. Body:', body);
        }
        return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="wss://${process.env.SERVER_URL}/media-stream" />
      </Connect>
    </Response>`;
    }
    async getTransferDial(res) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>Connecting you to the office now.</Say>
      <Dial record="record-from-answer-dual" 
            recordingStatusCallback="https://${process.env.SERVER_URL}/calls/recording-callback" 
            callerId="+19297022797">
        <Number>+19297696545</Number>
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
                console.log(`✅ Recording link synced for SID ${CallSid}: ${directUrl}`);
            }
            catch (error) {
                console.error('❌ DB Update Error during callback:', error.message);
            }
        }
        return { status: 'ok' };
    }
    async streamRecording(url, res) {
        if (!url || url === 'undefined' || url === 'null' || url === '') {
            return res.status(400).send('Recording URL is required');
        }
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
            if (!res.headersSent)
                res.status(500).send('Internal Error');
        }
    }
    getClinicCalls(clinicId) {
        return this.callsService.getHistoryByBusiness(clinicId);
    }
};
exports.CallsController = CallsController;
__decorate([
    (0, common_1.Post)('incoming-call'),
    (0, common_1.Header)('Content-Type', 'text/xml'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "handleIncomingCall", null);
__decorate([
    (0, common_1.Post)('transfer-dial'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
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