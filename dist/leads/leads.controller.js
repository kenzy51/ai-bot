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
const twilio = require("twilio");
let LeadsController = class LeadsController {
    client;
    callsService;
    constructor() {
        this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    handleIncomingCall() {
        return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream 
        url="wss://${process.env.SERVER_URL}/media-stream" 
        record="true" 
        recordingStatusCallback="${process.env.SERVER_URL}/leads/recording-callback"
        recordingStatusCallbackMethod="POST"/>
      </Connect>
    </Response>`;
    }
    async handleRecordingCallback(body) {
        const { RecordingUrl, RecordingSid, CallSid, RecordingDuration } = body;
        console.log(`Recording finished for Call ${CallSid}`);
        console.log(`Download link: ${RecordingUrl}`);
        await this.callsService.updateCallRecording(CallSid, RecordingUrl);
        return { status: 'received' };
    }
};
exports.LeadsController = LeadsController;
__decorate([
    (0, common_1.Post)('incoming-call'),
    (0, common_1.Header)('Content-Type', 'text/xml'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "handleIncomingCall", null);
__decorate([
    (0, common_1.Post)('recording-callback'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "handleRecordingCallback", null);
exports.LeadsController = LeadsController = __decorate([
    (0, common_1.Controller)('leads'),
    __metadata("design:paramtypes", [])
], LeadsController);
//# sourceMappingURL=leads.controller.js.map