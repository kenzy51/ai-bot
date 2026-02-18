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

  // 2. Fetch calls for your Next.js Dashboard
  async getHistoryByBusiness(businessId: string): Promise<Call[]> {
    return this.callModel
      .find({ businessId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(50) // Don't overload the dashboard
      .exec();
  }
}