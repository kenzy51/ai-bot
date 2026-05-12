import { VoiceService } from "../gemini/voice.service";
export declare class ChatGateway {
    private readonly voiceService;
    constructor(voiceService: VoiceService);
    handleMessage(client: any, payload: {
        text: string;
        history: any[];
    }): Promise<{
        event: string;
        data: string;
    }>;
}
