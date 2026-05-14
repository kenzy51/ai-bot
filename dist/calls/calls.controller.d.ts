import { CallsService } from './calls.service';
import { Response } from 'express';
import { VoiceService } from 'src/ai-agent/gemini/voice.service';
export declare class CallsController {
    private readonly callsService;
    private readonly voiceService;
    private client;
    constructor(callsService: CallsService, voiceService: VoiceService);
    handleIncoming(body: any, res: any): Promise<any>;
    getTransferDial(to: string, res: any): Promise<any>;
    handleRecordingCallback(body: any): Promise<{
        status: string;
    }>;
    streamRecording(url: string, res: Response | any): Promise<any>;
    getClinicCalls(clinicId: string): Promise<import("./schemas/call.schema").Call[]>;
}
