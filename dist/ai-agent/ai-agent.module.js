"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAgentModule = void 0;
const common_1 = require("@nestjs/common");
const voice_gateway_1 = require("./voice/voice.gateway");
const calls_module_1 = require("../calls/calls.module");
const voice_service_1 = require("./gemini/voice.service");
const config_1 = require("./config/config");
let AiAgentModule = class AiAgentModule {
};
exports.AiAgentModule = AiAgentModule;
exports.AiAgentModule = AiAgentModule = __decorate([
    (0, common_1.Module)({
        providers: [
            voice_service_1.VoiceService,
            voice_gateway_1.VoiceGateway,
            config_1.ConfigStore,
        ],
        exports: [voice_service_1.VoiceService, config_1.ConfigStore],
        imports: [calls_module_1.CallsModule],
    })
], AiAgentModule);
//# sourceMappingURL=ai-agent.module.js.map