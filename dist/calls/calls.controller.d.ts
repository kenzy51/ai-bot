import { CallsService } from './calls.service';
import { Response } from 'express';
export declare class CallsController {
    private readonly callsService;
    constructor(callsService: CallsService);
    handleIncoming(res: any): Promise<any>;
    getTransferDial(res: any): Promise<any>;
    handleRecordingCallback(body: any): Promise<{
        status: string;
    }>;
    streamRecording(url: string, res: Response | any): Promise<any>;
    getClinicCalls(clinicId: string): Promise<import("./schemas/call.schema").Call[]>;
}
