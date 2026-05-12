import { VoiceService } from "../gemini/voice.service";
import { Socket } from "socket.io";
export declare class ChatGateway {
    private readonly voiceService;
    constructor(voiceService: VoiceService);
    handleMessage(client: Socket, payload: {
        text: string;
        history: any[];
    }): Promise<void>;
}
