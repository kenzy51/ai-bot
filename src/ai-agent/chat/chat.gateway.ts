// chat.gateway.ts
import { 
  SubscribeMessage, 
  WebSocketGateway, 
  ConnectedSocket, 
  MessageBody 
} from "@nestjs/websockets";
import { VoiceService } from "../gemini/voice.service";
import { Socket } from "socket.io";

@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway {
  constructor(private readonly voiceService: VoiceService) {}

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket, 
    @MessageBody() payload: { text: string; history: any[] }
  ) {
    console.log(`💬 Web Message from ${client.id}: ${payload.text}`);

    const aiResponse = await this.voiceService.generateTextOnlyResponse(
      payload.text,
      payload.history
    );

    // 💡 client.emit is more explicit and reliable for Socket.io
    client.emit('ai_response', aiResponse);
  }
}