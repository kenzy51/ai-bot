import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { GeminiService } from '../gemini/gemini.service';
import * as WebSocket from 'ws';
export declare class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly geminiService;
    constructor(geminiService: GeminiService);
    handleConnection(twilioWs: WebSocket): void;
    handleDisconnect(): void;
}
