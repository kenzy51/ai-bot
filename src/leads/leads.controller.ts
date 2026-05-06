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
  // 💡 LOG THE ENTIRE BODY TO RENDER LOGS
  // This is the only way to see if the data is actually arriving
  console.log('--- TWILIO CALLBACK ARRIVED ---');
  console.log('Raw Body:', body);

  // Twilio uses PascalCase for keys
  const url = body.RecordingUrl; 
  const sid = body.CallSid;

  if (!url || !sid) {
    console.error('❌ Callback missing data:', { url, sid });
    return { status: 'missing_data' };
  }

  const finalUrl = `${url}.wav`;
  
  try {
    const updated = await this.callsService.updateCallRecording(sid, finalUrl);
    if (updated) {
      console.log(`✅ Database updated for SID: ${sid}`);
    } else {
      console.warn(`⚠️ No record found in DB for SID: ${sid}`);
    }
  } catch (error) {
    console.error('❌ DB Update Error:', error.message);
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