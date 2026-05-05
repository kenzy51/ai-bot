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
    private readonly voiceService: VoiceService,
    private readonly configStore: ConfigStore,
  ) {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  @Post('incoming-call')
  @Header('Content-Type', 'text/xml')
  handleIncomingCall(@Body() body: any) {
    const from = body.From;
    const sid = body.CallSid;

    if (from && sid) {
      this.voiceService.setCallerData(sid, from);
      console.log(`📞 Incoming call from: ${from} (SID: ${sid})`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="wss://${process.env.SERVER_URL}/media-stream" />
      </Connect>
    </Response>`;
  }

  @Post('update-config')
  async updateConfig(
    @Body() body: { knowledge: string; keywords: string; greeting: string },
  ) {
    this.configStore.updateConfig(body.knowledge, body.keywords, body.greeting);
    console.log(
      '✨ Bot Configuration Updated (Knowledge + Keywords + Greeting)',
    );
    return { success: true };
  }

  @Post('recording-callback')
  async handleRecordingCallback(@Body() body: any) {
    const { RecordingUrl, CallSid } = body;
    if (RecordingUrl) {
      const finalUrl = `${RecordingUrl}.wav`;
      try {
        await this.callsService.updateCallRecording(CallSid, finalUrl);
      } catch (error) {
        console.error('❌ DB Update Error:', error.message);
      }
    }
    return { status: 'received' };
  }
  @Get('config')
  async getConfig() {
    return {
      knowledge: this.configStore.getKnowledge(),
      keywords: this.configStore.getKeywords().join(', '), // Convert array back to string for the input
      greeting: this.configStore.getGreeting(),
    };
  }
}
