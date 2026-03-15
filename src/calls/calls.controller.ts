import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { CallsService } from './calls.service';
import { AnyExpression } from 'mongoose';

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}
  @Post('transfer-dial')
  async getTransferDial(@Res() res: any) {
    console.log('📞 Twilio is requesting transfer TwiML...');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>Connecting you to the office now.</Say>
      <Dial callerId="+19297022797" timeout="60">
        // <Number>+19178580233</Number>
        <Number>+19297696545</Number>
      </Dial>
    </Response>`;

    res.set('Content-Type', 'text/xml');
    return res.send(twiml);
  }
  // src/calls/calls.controller.ts
  @Post('recording-callback')
  async handleRecordingCallback(@Body() body: any) {
    const { CallSid, RecordingUrl, RecordingDuration } = body;

    await this.callsService.updateCallRecording(CallSid, RecordingUrl);
    console.log(`✅ Recording saved for ${CallSid}: ${RecordingUrl}`);
  }
  // src/calls/calls.controller.ts
  @Get('stream-recording')
  async streamRecording(@Query('url') recordingUrl: string, @Res() res: any) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.error('❌ Environment variables are missing!');
      return res.status(500).send('Server configuration error');
    }

    const cleanUrl = recordingUrl.replace('.json', '');
    console.log('📡 Proxying request to:', cleanUrl);

    try {
      const response = await fetch(cleanUrl, {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(
              `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
            ).toString('base64'),
        },
      });

      if (!response.ok) {
        console.error(
          '❌ Twilio returned:',
          response.status,
          response.statusText,
        );
        return res.status(500).send('Twilio request failed');
      }

      // THIS IS THE CORRECT WAY TO HANDLE BINARY DATA
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.set({
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length,
      });

      return res.send(buffer);
    } catch (error) {
      console.error('❌ Proxy Crash:', error); 
      return res.status(500).send('Internal Server Error');
    }
  }
  @Get('test-audio')
  async testAudio(@Res() res: any) {
    console.log('🚀 TEST ROUTE HIT!');
    return res.send('SERVER IS WORKING');
  }
  @Get(':clinicId')
  getClinicCalls(@Param('clinicId') clinicId: string) {
    return this.callsService.getHistoryByBusiness(clinicId);
  }
}
