import { OnModuleInit } from '@nestjs/common';
import { CallsService } from 'src/calls/calls.service';
export declare class GeminiService implements OnModuleInit {
    private readonly callsService;
    private deepgram;
    private groq;
    private calendar;
    private twilioClient;
    private isProcessing;
    private elevenlabs;
    private lastAction;
    private chatHistory;
    private callStatus;
    constructor(callsService: CallsService);
    onModuleInit(): Promise<void>;
    makeOutboundCall(to: string): Promise<void>;
    private getGroqTools;
    generateResponse(userText: string): Promise<any>;
    onCallDisconnect(): Promise<void>;
    private logToDatabase;
    private handleNotifications;
    private createCalendarEvent;
    speak(text: string): Promise<Buffer>;
    getDeepgramLive(): import("@deepgram/sdk").ListenLiveClient;
    getInitialGreeting(): Promise<string>;
}
