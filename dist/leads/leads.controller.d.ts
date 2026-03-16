import { CallsService } from 'src/calls/calls.service';
export declare class LeadsController {
    private client;
    callsService: CallsService;
    constructor();
    handleIncomingCall(): string;
    handleRecordingCallback(body: any): Promise<{
        status: string;
    }>;
}
