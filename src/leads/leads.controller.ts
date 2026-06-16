/* eslint-disable prettier/prettier */
import { Controller, Post, Body, Header, Get } from '@nestjs/common';
import { ConfigStore } from 'src/ai-agent/config/config';
import { VoiceService } from 'src/ai-agent/gemini/chat.service';
import { CallsService } from 'src/sessions/session.service';
import twilio = require('twilio');

@Controller('leads')
export class LeadsController {
  private client: twilio.Twilio;

  constructor(
    private readonly callsService: CallsService,
    private readonly configStore: ConfigStore,
  ) {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  /**
   * 💾 Sync Bot Configuration from Dashboard
   */
  @Post('update-config')
  async updateConfig(
    @Body()
    body: {
      knowledge: string;
      keywords: string;
      greeting: string;
      prompt: string; // This is the Voice Prompt
      chatPrompt: string; // This is the Chat Prompt
    },
  ) {
    this.configStore.updateConfig(body);

    console.log('✨ Sarah Updated: Neural Layers Synchronized');
    return { success: true };
  }

  @Get('config')
  async getConfig() {
    return {
      knowledge: this.configStore.getKnowledge(),
      keywords: this.configStore.getKeywords(),
      greeting: this.configStore.getGreeting(),
      prompt: this.configStore.getVoicePrompt(),
      chatPrompt: this.configStore.getChatPrompt(),
    };
  }
}
