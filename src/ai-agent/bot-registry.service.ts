import { Injectable } from "@nestjs/common";
import { BotSettings } from "src/config/bot.settings.interface";

@Injectable()
export class BotRegistryService {
  async getSettings(phoneNumber: string): Promise<Partial<BotSettings>> {
    return {
      clinicId: 'tribeca-1',
      clinicName: 'Tribeca Dental Studio',
      twilioNumber: '+19297022797',
      offerPrice: '$49',
      voiceId: 'PBZ6PhGMbBIzGFQBGF5u',
      // YOUR DASHBOARD STRING
      systemPrompt: "You are Jessica at {{clinicName}}. Time is {{nyTime}}. Focus on the {{offerPrice}} evaluation...",
      customKnowledge: "Dr. Sam Morhaim is our surgical expert..."
    };
  }
}