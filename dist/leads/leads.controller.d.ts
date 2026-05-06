import { ConfigStore } from 'src/ai-agent/config/config';
import { VoiceService } from 'src/ai-agent/gemini/voice.service';
import { CallsService } from 'src/calls/calls.service';
export declare class LeadsController {
    private readonly callsService;
    private readonly voiceService;
    private readonly configStore;
    private client;
    constructor(callsService: CallsService, voiceService: VoiceService, configStore: ConfigStore);
    handleIncomingCall(body: any): Promise<string>;
    updateConfig(body: {
        knowledge: string;
        keywords: string;
        greeting: string;
    }): Promise<{
        success: boolean;
    }>;
    handleRecordingCallback(body: any): Promise<{
        status: string;
    }>;
    getConfig(): Promise<{
        knowledge: string;
        keywords: string;
        greeting: string;
    }>;
}
