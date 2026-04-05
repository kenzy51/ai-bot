import { Model } from 'mongoose';
import { Call } from './schemas/call.schema';
export declare class CallsService {
    private callModel;
    constructor(callModel: Model<Call>);
    saveCall(callData: Partial<Call>): Promise<Call>;
    updateCallRecording(callSid: string, recordingUrl: string): Promise<import("mongoose").Document<unknown, {}, Call, {}, import("mongoose").DefaultSchemaOptions> & Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    getHistoryByBusiness(businessId: string): Promise<Call[]>;
}
