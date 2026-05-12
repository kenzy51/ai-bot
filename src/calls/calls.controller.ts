import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
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

  /**
   * 📞 Handle Incoming Call
   */
  // @Post('incoming-call')
  //   @Header('Content-Type', 'text/xml')
  //   async handleIncomingCall(@Body() body: any) {
  //     // 💡 Robust extraction to handle different parsing scenarios
  //     const from = body.From || body.from;
  //     const sid = body.CallSid || body.callSid;

  //     console.log(`📞 RECEIVED CALL DATA - From: ${from}, SID: ${sid}`);

  //     if (from && sid) {
  //       // 💡 Important: Use await to ensure the DB record exists
  //       // before the Gemini stream or Recording starts.
  //       await this.voiceService.setCallerData(sid, from);

  //       try {
  //         await this.client.calls(sid).recordings.create({
  //           recordingStatusCallback: `https://${process.env.SERVER_URL}/calls/recording-callback`,
  //           recordingStatusCallbackMethod: 'POST',
  //           trim: 'trim-silence',
  //         });
  //         console.log(`✨ Recording triggered for SID: ${sid}`);
  //       } catch (err) {
  //         console.error('❌ Recording trigger failed:', err.message);
  //       }
  //     } else {
  //       console.warn('⚠️ WARNING: Incoming call arrived without From or CallSid. Body:', body);
  //     }

  //     return `<?xml version="1.0" encoding="UTF-8"?>
  //     <Response>
  //       <Connect>
  //         <Stream url="wss://${process.env.SERVER_URL}/media-stream" />
  //       </Connect>
  //     </Response>`;
  //   }

  // CallsController.ts
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
      recordingStatusCallback="https://${process.env.SERVER_URL}/calls/recording-callback"
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
   * 🔀 Transfer Dial TwiML
   */
  @Post('transfer-dial')
  async getTransferDial(@Res() res: any) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>Connecting you to the office now.</Say>
      <Dial record="record-from-answer-dual" 
            recordingStatusCallback="https://${process.env.SERVER_URL}/calls/recording-callback" 
            callerId="+19297022797">
        <Number>+19297696545</Number>
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
        console.log(
          `✅ Recording link synced for SID ${CallSid}: ${directUrl}`,
        );
      } catch (error) {
        console.error('❌ DB Update Error during callback:', error.message);
      }
    }
    return { status: 'ok' };
  }

  /**
   * 🔊 Audio Stream Proxy
   */
  @Get('stream-recording')
  async streamRecording(@Query('url') url: string, @Res() res: Response | any) {
    if (!url || url === 'undefined' || url === 'null' || url === '') {
      return res.status(400).send('Recording URL is required');
    }

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
      if (!res.headersSent) res.status(500).send('Internal Error');
    }
  }

  @Get(':clinicId')
  getClinicCalls(@Param('clinicId') clinicId: string) {
    return this.callsService.getHistoryByBusiness(clinicId);
  }
}
