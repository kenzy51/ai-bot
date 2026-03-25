import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { GeminiService2 } from '../gemini/gemini.service2';
import * as WebSocket from 'ws';
export declare class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly geminiService;
    constructor(geminiService: GeminiService2);
    handleConnection(twilioWs: WebSocket): void;
    handleDisconnect(): void;
}
