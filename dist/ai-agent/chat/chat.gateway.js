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
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const voice_service_1 = require("../gemini/voice.service");
let ChatGateway = class ChatGateway {
    voiceService;
    constructor(voiceService) {
        this.voiceService = voiceService;
    }
    handleConnection(client) {
        console.log(`📡 New Web Chat Connection: ${client.id || 'WebUser'}`);
    }
    async handleMessage(client, payload) {
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        console.log(`💬 Message: ${data.text}`);
        const aiResponse = await this.voiceService.generateTextOnlyResponse(data.text, data.history || []);
        client.send(JSON.stringify({
            event: 'ai_response',
            data: aiResponse
        }));
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.SubscribeMessage)('message'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMessage", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/chat-stream', cors: { origin: '*' } }),
    __metadata("design:paramtypes", [voice_service_1.VoiceService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map