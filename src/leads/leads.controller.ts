/* eslint-disable prettier/prettier */
import { Controller, Post, Body, Header, Get } from '@nestjs/common';
import { ConfigStore } from 'src/ai-agent/config/config';
import { VoiceService } from 'src/ai-agent/gemini/voice.service';
import { CallsService } from 'src/calls/calls.service';
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
    @Body() body: { knowledge: string; keywords: string; greeting: string; prompt:string },
  ) {
    this.configStore.updateConfig(body.knowledge, body.keywords, body.greeting, body.prompt);
    console.log('✨ Sarah Updated: Knowledge + Keywords + Greeting');
    return { success: true };
  }


  /**
   * ⚙️ Fetch current config for Dashboard UI
   */
  @Get('config')
  async getConfig() {
    return {
      knowledge: this.configStore.getKnowledge(),
      keywords: this.configStore.getKeywords().join(', '), 
      greeting: this.configStore.getGreeting(),
      prompt: this.configStore.getPrompt(),
    };
  }
}