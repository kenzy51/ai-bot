import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { CallsService } from './calls.service';
import { Readable } from 'node:stream';
import { Response } from 'express';

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  /**
   * 📞 Inbound Call TwiML
   * Connects the caller to the AI Media Stream.
   * Note: Recording is triggered via API in the LeadsController.
   */
  @Post('incoming-call')
  async handleIncoming(@Res() res: any) {
    const serverUrl = process.env.SERVER_URL || 'fusion-ai-bot.onrender.com';

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${serverUrl}/media-stream" />
  </Connect>
</Response>`.trim();

    res.set('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  /**
   * 🔀 Transfer Dial TwiML
   * Used when Sarah transfers the caller to the physical office.
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

  /**
   * 🎙️ Recording Callback
   * Receives the metadata from Twilio and updates the database.
   */
  @Post('recording-callback')
  async handleRecordingCallback(@Body() body: any) {
    const { CallSid, RecordingUrl } = body;

    if (RecordingUrl && CallSid) {
      // Ensure the URL ends in .wav so the browser audio player works
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
   * Fetches the private recording from Twilio and streams it to the Dashboard.
   */
  @Get('stream-recording')
  async streamRecording(@Query('url') url: string, @Res() res: Response | any) {
    // 💡 GUARD: Prevent "TypeError: Invalid URL" crash if URL is empty or null
    if (!url || url === 'undefined' || url === 'null' || url === '') {
      console.error('⚠️ Proxy Error: Request received with empty/invalid URL');
      return res.status(400).send('Recording URL is required');
    }

    try {
      console.log(`🎙️ Proxying Twilio Audio Stream: ${url}`);

      const response = await fetch(url, {
        headers: {
          // Required to access private Twilio recordings
          Authorization:
            'Basic ' +
            Buffer.from(
              `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
            ).toString('base64'),
        },
      });

      if (!response.ok) {
        console.error(`❌ Twilio Auth/Fetch Failed: ${response.status}`);
        return res
          .status(response.status)
          .send('Could not fetch audio from Twilio');
      }

      // Set headers for smooth browser playback
      res.set({
        'Content-Type': 'audio/wav',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*', // Allows Next.js to read the stream
      });

      // Efficiently pipe the web stream to the response
      if (response.body) {
        const body = Readable.fromWeb(response.body as any);
        body.pipe(res);
      }
    } catch (error) {
      console.error('❌ Proxy Crash Details:', error.message);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error during audio proxy');
      }
    }
  }

  /**
   * 📋 Fetch History
   */
  @Get(':clinicId')
  getClinicCalls(@Param('clinicId') clinicId: string) {
    return this.callsService.getHistoryByBusiness(clinicId);
  }
}
