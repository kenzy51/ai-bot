import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Call } from './schemas/call.schema';

@Injectable()
export class CallsService {
  constructor(@InjectModel(Call.name) private callModel: Model<Call>) {}

  // 1. Save the call at the end of the conversation
  async saveCall(callData: Partial<Call>): Promise<Call> {
    const record = new this.callModel(callData);
    return record.save();
  }

  async updateCall(
    callSid: string,
    updateData: Partial<Call>,
  ): Promise<Call | null> {
    return await this.callModel
      .findOneAndUpdate({ callSid }, { $set: updateData }, { new: true })
      .exec();
  }

  async updateCallRecording(callSid: string, recordingUrl: string) {
    return await this.callModel.findOneAndUpdate(
      { callSid: callSid },
      { $set: { recordingUrl: recordingUrl } },
      { new: true },
    );
  }
  async getHistoryByBusiness(businessId: string): Promise<Call[]> {
    return this.callModel
      .find({ businessId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(50) // Don't overload the dashboard
      .exec();
  }
}
