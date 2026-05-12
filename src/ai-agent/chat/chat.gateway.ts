// chat.gateway.ts
import { SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";
import { VoiceService } from "../gemini/voice.service";

@WebSocketGateway({ namespace: 'chat', cors: { origin: '*' } })
export class ChatGateway {
  // 💡 Inject the service via constructor to use the shared "Sarah" brain
  constructor(private readonly voiceService: VoiceService) {}

  @SubscribeMessage('message')
  async handleMessage(client: any, payload: { text: string; history: any[] }) {
    // 💡 This calls the new text-only method we'll add below
    const aiResponse = await this.voiceService.generateTextOnlyResponse(
      payload.text,
      payload.history
    );

    // 💡 Return the response so the widget can display it
    return { event: 'ai_response', data: aiResponse };
  }
}