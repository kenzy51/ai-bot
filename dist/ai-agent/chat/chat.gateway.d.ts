import { OnGatewayConnection } from "@nestjs/websockets";
import { VoiceService } from "../gemini/voice.service";
export declare class ChatGateway implements OnGatewayConnection {
    private readonly voiceService;
    constructor(voiceService: VoiceService);
    handleConnection(client: any): void;
    handleMessage(client: any, payload: any): Promise<void>;
}
