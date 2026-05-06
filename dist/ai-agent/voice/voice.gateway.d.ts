import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { VoiceService } from '../gemini/voice.service';
import * as WebSocket from 'ws';
export declare class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly voiceService;
    constructor(voiceService: VoiceService);
    private chatHistories;
    private sessions;
    handleConnection(twilioWs: WebSocket): void;
    handleDisconnect(twilioWs: WebSocket): Promise<void>;
}
