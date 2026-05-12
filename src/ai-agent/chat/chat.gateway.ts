// chat.gateway.ts
import { 
  SubscribeMessage, 
  WebSocketGateway, 
  OnGatewayConnection 
} from "@nestjs/websockets";
import { VoiceService } from "../gemini/voice.service";

@WebSocketGateway({ path: '/chat-stream', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection {
  constructor(private readonly voiceService: VoiceService) {}

  handleConnection(client: any) {
    console.log(`📡 New Web Chat Connection: ${client.id || 'WebUser'}`);
  }

  @SubscribeMessage('message')
  async handleMessage(client: any, payload: any) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    
    console.log(`💬 Message: ${data.text}`);

    const aiResponse = await this.voiceService.generateTextOnlyResponse(
      data.text,
      data.history || []
    );

    client.send(JSON.stringify({
      event: 'ai_response',
      data: aiResponse
    }));
  }
}