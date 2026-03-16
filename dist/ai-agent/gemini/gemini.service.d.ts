import WebSocket = require('ws');
export declare class GeminiService {
    private deepgram;
    private groq;
    private ttsSockets;
    generateResponse(userText: string, history: any[], twilioWs: WebSocket, streamSid: string): Promise<string>;
    streamTts(text: string, streamSid: string, twilioWs: WebSocket): Promise<void>;
    getInitialGreeting(): Promise<string>;
    getDeepgramLive(): import("@deepgram/sdk").ListenLiveClient;
    cleanup(streamSid: string): void;
}
