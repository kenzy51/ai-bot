import { CallsService } from './calls.service';
export declare class CallsController {
    private readonly callsService;
    constructor(callsService: CallsService);
    getTransferDial(res: any): Promise<any>;
    handleRecordingCallback(body: any): Promise<void>;
    streamRecording(recordingUrl: string, res: any): Promise<any>;
    testAudio(res: any): Promise<any>;
    getClinicCalls(clinicId: string): Promise<import("./schemas/call.schema").Call[]>;
}
