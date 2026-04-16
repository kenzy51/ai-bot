import { CallsService } from 'src/calls/calls.service';
export declare class LeadsController {
    private readonly callsService;
    private client;
    constructor(callsService: CallsService);
    handleIncomingCall(): string;
    handleRecordingCallback(body: any): Promise<{
        status: string;
    }>;
}
