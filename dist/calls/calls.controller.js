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
let CallsController = class CallsController {
    callsService;
    constructor(callsService) {
        this.callsService = callsService;
    }
    async handleIncoming(res) {
        const ngrokUrl = 'https://lesa-jovial-blushfully.ngrok-free.dev';
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Recording 
      recordingStatusCallback="${ngrokUrl}/calls/recording-callback"
      recordingStatusCallbackMethod="POST"
    />
  </Start>
  <Connect>
    <Stream url="wss://${ngrokUrl.replace('https://', '')}/media-stream" />
  </Connect>
</Response>`.trim();
        res.set('Content-Type', 'text/xml');
        return res.status(200).send(twiml);
    }
    async getTransferDial(res) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Say>Connecting you to the office now.</Say>
    <Dial record="record-from-answer-dual" 
          recordingStatusCallback="https://fusion-ai-bot.onrender.com/calls/recording-callback" 
          callerId="+19297022797">
      <Number>+19297696545</Number>
    </Dial>
  </Response>`;
        res.set('Content-Type', 'text/xml');
        return res.status(200).send(twiml);
    }
    async handleRecordingCallback(body) {
        const { CallSid, RecordingUrl } = body;
        if (RecordingUrl) {
            const directUrl = `${RecordingUrl}.wav`;
            await this.callsService.updateCallRecording(CallSid, directUrl);
            console.log(`✅ Recording link synced: ${directUrl}`);
        }
        return { status: 'ok' };
    }
    async streamRecording(recordingUrl, res) {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.error('❌ Environment variables are missing!');
            return res.status(500).send('Server configuration error');
        }
        const cleanUrl = recordingUrl.replace('.json', '');
        console.log('📡 Proxying request to:', cleanUrl);
        try {
            const response = await fetch(cleanUrl, {
                headers: {
                    Authorization: 'Basic ' +
                        Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
                },
            });
            if (!response.ok) {
                console.error('❌ Twilio returned:', response.status, response.statusText);
                return res.status(500).send('Twilio request failed');
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            res.set({
                'Content-Type': 'audio/wav',
                'Content-Length': buffer.length,
            });
            return res.send(buffer);
        }
        catch (error) {
            console.error('❌ Proxy Crash:', error);
            return res.status(500).send('Internal Server Error');
        }
    }
    async testAudio(res) {
        console.log('🚀 TEST ROUTE HIT!');
        return res.send('SERVER IS WORKING');
    }
    getClinicCalls(clinicId) {
        return this.callsService.getHistoryByBusiness(clinicId);
    }
};
exports.CallsController = CallsController;
__decorate([
    (0, common_1.Post)('incoming-call'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "handleIncoming", null);
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
    (0, common_1.Get)('test-audio'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CallsController.prototype, "testAudio", null);
__decorate([
    (0, common_1.Get)(':clinicId'),
    __param(0, (0, common_1.Param)('clinicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CallsController.prototype, "getClinicCalls", null);
exports.CallsController = CallsController = __decorate([
    (0, common_1.Controller)('calls'),
    __metadata("design:paramtypes", [calls_service_1.CallsService])
], CallsController);
//# sourceMappingURL=calls.controller.js.map