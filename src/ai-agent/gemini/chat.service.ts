import { Injectable, OnModuleInit } from '@nestjs/common';
import Groq from 'groq-sdk';
import sgMail from '@sendgrid/mail';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant } from 'src/tenant/tenant.schema';
import { ChatSession } from 'src/sessions/schemas/session.schema';
import { SessionsService } from 'src/sessions/session.service';
import Redis from 'ioredis';

@Injectable()
export class ChatService implements OnModuleInit {
  private groq: Groq;
  private redis: Redis;

  constructor(
    private readonly sessionsService: SessionsService,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
    @InjectModel(ChatSession.name) private readonly sessionModel: Model<ChatSession>,
  ) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // 🚀 REDIS: Establish connection for extreme margin control caching
    this.redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  }

  async onModuleInit() {
    console.log('🚀 Fusion Chat Engine Activated. Stateless Tenancy Engaged.');
  }

  /**
   * Generates a fully dynamic text response checking cache first to protect MongoDB IOPS bounds.
   */
  async generateTextOnlyResponse(
    userText: string,
    passedHistory: any[],
    businessId: string,
  ): Promise<string> {
    const leanHistory = passedHistory.slice(-10);

    try {
      // 🔍 SYSTEMS DESIGN PATTERN: Cache-Aside Layer
      const cacheKey = `tenant:${businessId}:config`;
      let tenantConfigString = await this.redis.get(cacheKey);
      let currentTenant: any;

      if (tenantConfigString) {
        currentTenant = JSON.parse(tenantConfigString);
      } else {
        // Cache miss -> Hit MongoDB securely
        currentTenant = await this.tenantModel
          .findOne({
            $or: [{ _id: businessId }, { slug: businessId }],
          })
          .exec();

        if (!currentTenant) {
          return 'System error: Tenant configuration node not found.';
        }

        // Cache config for 5 minutes (300s) to limit database overhead
        await this.redis.set(
          cacheKey,
          JSON.stringify(currentTenant),
          'EX',
          300,
        );
      }

      // Extract system prompts and knowledge base
      const dynamicKnowledge = currentTenant.voiceConfig?.knowledgeBase || '';
      const dynamicSystemChatPrompt =
        currentTenant.voiceConfig?.chatPrompt || 'You are a helpful assistant.';

      // Get precision completion from Groq
      const response = await this.groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `${dynamicSystemChatPrompt}\n\n# KNOWLEDGE BASE\n${dynamicKnowledge}\n`,
          },
          ...leanHistory,
          { role: 'user', content: userText },
        ],
        temperature: 0.5,
      });

      return (
        response.choices[0]?.message?.content ||
        "I'm sorry, I couldn't process that response."
      );
    } catch (err) {
      console.error('❌ Groq Dynamic Multi-Tenant Chat Error:', err);
      return "I'm having trouble connecting to the systems database. Please try again in a moment.";
    }
  }

  /**
   * Logs conversational analytics asynchronously back to MongoDB when a session completes
   */
  async logSessionToDatabase(
    conversationId: string,
    history: any[],
    tenantId: string,
  ) {
    try {
      let summary = 'Chat Inquiry';

      if (history.length >= 2) {
        const sumResp = await this.groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content:
                'Summarize this conversation context in one brief sentence.',
            },
            {
              role: 'user',
              content: history.map((h) => `${h.role}: ${h.content}`).join('\n'),
            },
          ],
        });
        summary = sumResp.choices[0]?.message?.content || summary;
      }

      await this.sessionsService.saveSession({
        tenantId,
        sessionId: conversationId, // repurpose session tracking ID
        endUserIp: 'Web Chat End User',
        summary,
        transcript: history.map((h) => `${h.role}: ${h.content}`).join('\n'),
        status: 'completed',
      });

      console.log(
        `✅ Multi-Tenant Chat Session saved securely for tenant: ${tenantId}`,
      );
    } catch (e) {
      console.error('❌ Async Chat Session Save failed:', e.message);
    }
  }
}