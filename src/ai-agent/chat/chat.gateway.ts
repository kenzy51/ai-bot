import { 
  SubscribeMessage, 
  WebSocketGateway, 
  OnGatewayConnection,
  OnGatewayDisconnect
} from "@nestjs/websockets";
import { ChatService } from "../gemini/chat.service";

@WebSocketGateway({ path: '/chat-stream', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: any) {
    console.log(`📡 New Multi-Tenant Web Chat Socket Connected: ${client.id}`);
  }

  @SubscribeMessage('message')
  async handleMessage(client: any, payload: any) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    
    const tenantId = data.tenantId; // Passed implicitly from the web widget code
    if (!tenantId) {
      client.send(JSON.stringify({ event: 'error', data: 'Missing tenant configuration identifier.' }));
      return;
    }

    console.log(`💬 Message received for Tenant [${tenantId}]: ${data.text}`);

    const aiResponse = await this.chatService.generateTextOnlyResponse(
      data.text,
      data.history || [],
      tenantId
    );

    client.send(JSON.stringify({
      event: 'ai_response',
      data: aiResponse
    }));
  }

  handleDisconnect(client: any) {
    console.log(`❌ Chat Socket Connection Severed: ${client.id}`);
  }
}