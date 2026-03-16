import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { GeminiService } from '../gemini/gemini.service';
import * as WebSocket from 'ws';
export declare class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly geminiService;
    constructor(geminiService: GeminiService);
    private isProcessingMap;
    handleConnection(twilioWs: WebSocket): void;
    handleDisconnect(twilioWs: WebSocket): void;
}
