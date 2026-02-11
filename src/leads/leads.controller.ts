/* eslint-disable prettier/prettier */
import { Controller, Post, Body, Header } from '@nestjs/common';
import twilio = require('twilio');
@Controller('leads')
export class LeadsController {
  private client: twilio.Twilio;

  constructor() {
    // Инициализируем в конструкторе, чтобы убедиться, что переменные окружения подтянуты
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
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

@Post('incoming-call') // Убедись, что здесь 'incoming-call'
  @Header('Content-Type', 'text/xml')
  handleIncomingCall() {
    console.log('--- Incoming call received! ---'); // Это появится в терминале VS Code
    return `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>Hello Kanat! Connecting you to Gemini.</Say>
        <Connect>
          <Stream url="wss://${process.env.SERVER_URL}/media-stream" />
        </Connect>
      </Response>`;
  }
}