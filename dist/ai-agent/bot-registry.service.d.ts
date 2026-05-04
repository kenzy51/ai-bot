import { BotSettings } from "src/config/bot.settings.interface";
export declare class BotRegistryService {
    getSettings(phoneNumber: string): Promise<Partial<BotSettings>>;
}
