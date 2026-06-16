import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatSession } from './schemas/session.schema'; 

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(ChatSession.name) private readonly sessionModel: Model<ChatSession>
  ) {}


  async saveSession(sessionData: Partial<ChatSession>): Promise<ChatSession> {
    return await this.sessionModel
      .findOneAndUpdate(
        { sessionId: sessionData.sessionId },
        { $set: sessionData },
        { upsert: true, new: true },
      )
      .exec();
  }

  /**
   * 📊 Fetches the historical session log array securely partitioned by tenantId.
   * Limits output to prevent unindexed document scanning bottlenecks.
   */
  async getHistoryByTenant(tenantId: string): Promise<ChatSession[]> {
    return this.sessionModel
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  /**
   * 🔍 Locates a single explicit chat conversation by its unique web socket thread ID.
   */
  async findBySessionId(sessionId: string): Promise<ChatSession | null> {
    return this.sessionModel
      .findOne({ sessionId })
      .exec();
  }

  /**
   * 🔒 Updates the active state of a session (active -> completed, human_escalated, etc.).
   */
  async updateStatus(sessionId: string, status: string): Promise<ChatSession | null> {
    return this.sessionModel
      .findOneAndUpdate(
        { sessionId },
        { $set: { status } },
        { new: true }
      )
      .exec();
  }

  /**
   * 🚩 Toggles the flag state for transcript compliance or administrative audit review.
   */
  async updateFlagState(sessionId: string, isFlagged: boolean): Promise<ChatSession | null> {
    return this.sessionModel
      .findOneAndUpdate(
        { sessionId },
        { $set: { isFlagged } },
        { new: true }
      )
      .exec();
  }
}