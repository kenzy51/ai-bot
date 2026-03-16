/* eslint-disable prettier/prettier */
import { Controller, Post, Body, Header } from '@nestjs/common';
import { CallsService } from 'src/calls/calls.service';
import twilio = require('twilio');
@Controller('leads')
export class LeadsController {
  private client: twilio.Twilio;
  callsService: CallsService;
  constructor() {
    // Инициализируем в конструкторе, чтобы убедиться, что переменные окружения подтянуты
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }
  /* eslint-disable prettier/prettier */
  @Post('incoming-call')
  @Header('Content-Type', 'text/xml')
  handleIncomingCall() {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream 
        url="wss://${process.env.SERVER_URL}/media-stream" 
        record="true" 
        recordingStatusCallback="${process.env.SERVER_URL}/leads/recording-callback"
        recordingStatusCallbackMethod="POST"/>
      </Connect>
    </Response>`;
  }

  @Post('recording-callback')
  async handleRecordingCallback(@Body() body: any) {
    const { RecordingUrl, RecordingSid, CallSid, RecordingDuration } = body;

    console.log(`Recording finished for Call ${CallSid}`);
    console.log(`Download link: ${RecordingUrl}`);

    // TODO: Save this to your database (MongoDB/Postgres)
    await this.callsService.updateCallRecording(CallSid, RecordingUrl);

    return { status: 'received' };
  }
  //   @Post('new-lead')
  //   async handleNewLead(@Body() leadData: { phone: string; name: string; clinicName: string }) {
  //     console.log(`New lead received: ${leadData.name} for ${leadData.clinicName}`);

  //     try {
  //       const call = await this.client.calls.create({
  //         // @ts-ignore
  //         from: process.env.TWILIO_PHONE_NUMBER,
  //         to: leadData.phone,
  //         twiml: `
  //           <Response>
  //             <Say>Connecting you to the ${leadData.clinicName} assistant.</Say>
  //             <Connect>
  //               <Stream url="wss://${process.env.SERVER_URL}/media-stream" />
  //             </Connect>
  //           </Response>`,
  //       });

  //       return { success: true, callSid: call.sid };
  //     } catch (error) {
  //       console.error('Twilio Call Error:', error);
  //       return { success: false, error: error.message };
  //     }
  //   }
}
