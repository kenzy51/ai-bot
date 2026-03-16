import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { GeminiService } from '../gemini/gemini.service';
import * as WebSocket from 'ws';
export declare class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly geminiService;
    private streamSid;
    private isGreetingSent;
    private isDeepgramReady;
    constructor(geminiService: GeminiService);
    handleConnection(twilioWs: WebSocket): void;
    handleDisconnect(twilioWs: WebSocket): void;
}
