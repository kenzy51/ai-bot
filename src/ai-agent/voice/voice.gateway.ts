/* eslint-disable prettier/prettier */
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GeminiService } from '../gemini/gemini.service';

@WebSocketGateway({
  path: '/media-stream',
  cors: { origin: '*' },
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private streamSid: string;

  constructor(private readonly geminiService: GeminiService) {}

  handleConnection(client: Socket) {
    console.log(`[Twilio] Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[Twilio] Disconnected: ${client.id}`);
  }

  // 1. Twilio sends 'start' when the call connects
  @SubscribeMessage('start')
  handleStart(client: Socket, payload: any) {
    this.streamSid = payload.start.streamSid;
    console.log(`[Twilio] Stream Started: ${this.streamSid}`);
    
    // Here we can initialize a unique Gemini session for this specific call
  }

  // 2. Twilio sends 'media' every 20ms with audio bytes
  @SubscribeMessage('media')
  async handleMedia(client: Socket, payload: any) {
    const audioPayload = payload.media.payload; // Base64 audio from patient
    
    // TODO: Send audioPayload to GeminiService
    // const aiResponse = await this.geminiService.processAudio(audioPayload);
    
    // 3. Send AI voice back to Twilio
    /*
    client.emit('media', {
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: aiResponse, // Base64 audio from Gemini
      },
    });
    */
  }
}