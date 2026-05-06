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

  /**
   * 📞 Handle Incoming Call
   * Triggers parallel recording and starts the Media Stream
   */
  @Post('incoming-call')
  @Header('Content-Type', 'text/xml')
  async handleIncomingCall(@Body() body: any) {
    const from = body.From;
    const sid = body.CallSid;

    if (from && sid) {
      this.voiceService.setCallerData(sid, from);

      try {
        // @ts-ignore
        await this.client.calls(sid).recordings.create({
          recordingStatusCallback: `https://${process.env.SERVER_URL}/leads/recording-callback`,
          recordingStatusCallbackMethod: 'POST',
          trim: 'trim-silence',
          playBeep: false
        });
        console.log(`✨ Background recording initiated for: ${sid}`);
      } catch (err) {
        console.error('❌ Failed to start background recording:', err.message);
      }
    }

    // 🧠 STEP 2: Return TwiML to connect to Sarah's Brain
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="wss://${process.env.SERVER_URL}/media-stream" />
      </Connect>
    </Response>`;
  }

  /**
   * 💾 Sync Bot Configuration from Dashboard
   */
  @Post('update-config')
  async updateConfig(
    @Body() body: { knowledge: string; keywords: string; greeting: string },
  ) {
    this.configStore.updateConfig(body.knowledge, body.keywords, body.greeting);
    console.log('✨ Sarah Updated: Knowledge + Keywords + Greeting');
    return { success: true };
  }

  /**
   * 🎙️ Update Database with the Recording URL once call ends
   */
  @Post('recording-callback')
  async handleRecordingCallback(@Body() body: any) {
    // Twilio uses PascalCase for these keys in the body
    const url = body.RecordingUrl;
    const sid = body.CallSid;

    if (url && sid) {
      // Append .wav so the browser audio player works immediately
      const finalUrl = url.endsWith('.wav') ? url : `${url}.wav`;
      
      try {
        console.log(`💾 Saving Recording: ${finalUrl} to SID: ${sid}`);
        await this.callsService.updateCallRecording(sid, finalUrl);
      } catch (error) {
        console.error('❌ DB Recording Update Error:', error.message);
      }
    }
    return { status: 'received' };
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
    };
  }
}