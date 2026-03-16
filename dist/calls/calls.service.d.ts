import { Model } from 'mongoose';
import { Call } from './schemas/call.schema';
export declare class CallsService {
    private callModel;
    constructor(callModel: Model<Call>);
    saveCall(callData: Partial<Call>): Promise<Call>;
    updateCall(callSid: string, updateData: Partial<Call>): Promise<Call | null>;
    updateCallRecording(callSid: string, recordingUrl: string): Promise<(import("mongoose").Document<unknown, {}, Call, {}, import("mongoose").DefaultSchemaOptions> & Call & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    getHistoryByBusiness(businessId: string): Promise<Call[]>;
}
