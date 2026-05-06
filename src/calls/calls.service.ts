import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Call } from './schemas/call.schema';

@Injectable()
export class CallsService {
  constructor(@InjectModel(Call.name) private callModel: Model<Call>) {}

  async saveCall(callData: Partial<Call>): Promise<Call> {
    return await this.callModel.findOneAndUpdate(
      { callSid: callData.callSid },
      { $set: callData },
      { upsert: true, new: true }
    ).exec();
  }

  // 2. Specialized method for the Twilio Recording Webhook
 async updateCallRecording(callSid: string, recordingUrl: string) {
  console.log(`📡 WEBHOOK HIT for SID: ${callSid}`);
  
  const update = await this.callModel.findOneAndUpdate(
    { callSid: callSid },
    { $set: { recordingUrl: recordingUrl } },
    { upsert: true, new: true }
  ).exec();

  console.log("💾 Database updated:", update);
  return update;
}

  async getHistoryByBusiness(businessId: string): Promise<Call[]> {
    return this.callModel
      .find({ businessId })
      .sort({ createdAt: -1 }) 
      .limit(50) 
      .exec();
  }
}