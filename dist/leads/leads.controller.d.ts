import { ConfigStore } from 'src/ai-agent/config/config';
import { CallsService } from 'src/calls/calls.service';
export declare class LeadsController {
    private readonly callsService;
    private readonly configStore;
    private client;
    constructor(callsService: CallsService, configStore: ConfigStore);
    updateConfig(body: {
        knowledge: string;
        keywords: string;
        greeting: string;
        prompt: string;
        chatPrompt: string;
    }): Promise<{
        success: boolean;
    }>;
    getConfig(): Promise<{
        knowledge: string;
        keywords: string[];
        greeting: string;
        prompt: string;
        chatPrompt: string;
    }>;
}
