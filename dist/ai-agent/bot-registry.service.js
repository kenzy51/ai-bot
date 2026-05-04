"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotRegistryService = void 0;
const common_1 = require("@nestjs/common");
let BotRegistryService = class BotRegistryService {
    async getSettings(phoneNumber) {
        return {
            clinicId: 'tribeca-1',
            clinicName: 'Tribeca Dental Studio',
            twilioNumber: '+19297022797',
            offerPrice: '$49',
            voiceId: 'PBZ6PhGMbBIzGFQBGF5u',
            systemPrompt: "You are Jessica at {{clinicName}}. Time is {{nyTime}}. Focus on the {{offerPrice}} evaluation...",
            customKnowledge: "Dr. Sam Morhaim is our surgical expert..."
        };
    }
};
exports.BotRegistryService = BotRegistryService;
exports.BotRegistryService = BotRegistryService = __decorate([
    (0, common_1.Injectable)()
], BotRegistryService);
//# sourceMappingURL=bot-registry.service.js.map