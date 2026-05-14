/* eslint-disable @typescript-eslint/no-explicit-any */
import { Body, Controller, Get, Post, Query, Res, Param } from '@nestjs/common';
import { CallsService } from './calls.service';
import { Readable } from 'node:stream';
import { Response } from 'express';
import { VoiceService } from 'src/ai-agent/gemini/voice.service';
import twilio = require('twilio');

@Controller('calls')
export class CallsController {
  private client: twilio.Twilio;

  constructor(
    private readonly callsService: CallsService,
    private readonly voiceService: VoiceService,
  ) {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  @Post('incoming-call')
  async handleIncoming(@Body() body: any, @Res() res: any) {
    const from = body.From;
    const sid = body.CallSid;

    if (from && sid) {
      await this.voiceService.setCallerData(sid, from);
    }

    const rawUrl = process.env.SERVER_URL || 'fusion-ai-bot.onrender.com';
    const cleanUrl = rawUrl.replace('https://', '').replace('http://', '');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Recording 
      recordingStatusCallback="https://${rawUrl}/calls/recording-callback"
    />
  </Start>
  <Connect>
    <Stream url="wss://${cleanUrl}/media-stream" />
  </Connect>
</Response>`;

    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  /**
   * 🔀 DYNAMIC Transfer Dial
   * This now accepts a 'to' query parameter from VoiceService
   */
@Post('transfer-dial')
  async getTransferDial(@Query('to') to: string, @Res() res: any) {
    const targetNumber = to || '+19177826487';
    
    // 💡 Ensure we have a clean base URL without extra protocols
    const rawUrl = process.env.SERVER_URL || 'fusion-ai-bot.onrender.com';
    const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Say>One moment, connecting you to the department now.</Say>
    <Dial record="record-from-answer-dual" 
          recordingStatusCallback="${baseUrl}/calls/recording-callback" 
          callerId="+19297022797">
      <Number>${targetNumber}</Number>
    </Dial>
  </Response>`;

    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  @Post('recording-callback')
  async handleRecordingCallback(@Body() body: any) {
    const { CallSid, RecordingUrl } = body;

    if (RecordingUrl && CallSid) {
      const directUrl = RecordingUrl.endsWith('.wav')
        ? RecordingUrl
        : `${RecordingUrl}.wav`;

      try {
        await this.callsService.updateCallRecording(CallSid, directUrl);
        console.log(`✅ Recording link synced: ${directUrl}`);
      } catch (error) {
        console.error('❌ DB Update Error:', error.message);
      }
    }
    return { status: 'ok' };
  }

  @Get('stream-recording')
  async streamRecording(@Query('url') url: string, @Res() res: Response | any) {
    if (!url || url === 'undefined')
      return res.status(400).send('URL required');

    try {
      const response = await fetch(url, {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(
              `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
            ).toString('base64'),
        },
      });

      if (!response.ok) return res.status(response.status).send('Fetch failed');

      res.set({
        'Content-Type': 'audio/wav',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
      });

      if (response.body) {
        const body = Readable.fromWeb(response.body as any);
        body.pipe(res);
      }
    } catch (error) {
      console.error('❌ Proxy Crash:', error.message);
    }
  }

  @Get(':clinicId')
  getClinicCalls(@Param('clinicId') clinicId: string) {
    return this.callsService.getHistoryByBusiness(clinicId);
  }
}
