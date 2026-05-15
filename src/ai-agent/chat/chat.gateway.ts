import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { IncomingMessage } from 'http';
import { VoiceService } from '../gemini/voice.service'; // Adjust path to match your layout

@WebSocketGateway({
  path: '/chat-stream',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Key: client (Socket), Value: room/chat ID
  private clientRooms = new Map<any, string>();
  
  // Key: room/chat ID, Value: Set of connected sockets (user widget + admin dashboard)
  private rooms = new Map<string, Set<any>>();

  // Set tracking chats where a human agent has intervened to silence Sarah
  private hijackedChats = new Set<string>();

  constructor(private readonly voiceService: VoiceService) {}

  /**
   * Handle incoming native WebSocket connections
   */
  handleConnection(client: any, request: IncomingMessage) {
    console.log('🔌 New browser connection established on /chat-stream');
    
    // Parse individual chat session or room identifier from the URL query parameters if present
    // e.g., wss://domain.com/chat-stream?chatId=6a064056...
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const chatId = url.searchParams.get('chatId');

    if (chatId) {
      this.joinRoom(client, chatId);
    }
  }

  /**
   * Clean up memories and maps upon disconnection to prevent RAM memory leaks
   */
  handleDisconnect(client: any) {
    const chatId = this.clientRooms.get(client);
    if (chatId) {
      console.log(`❌ Client disconnected from chat room: ${chatId}`);
      const roomClients = this.rooms.get(chatId);
      if (roomClients) {
        roomClients.delete(client);
        if (roomClients.size === 0) {
          this.rooms.delete(chatId);
          this.hijackedChats.delete(chatId); // Remove lock once session fully closes
        }
      }
      this.clientRooms.delete(client);
    }
  }

  /**
   * Explicit action to link a client to a room instance
   */
  @SubscribeMessage('join_room')
  handleJoinRoom(client: any, payload: { chatId: string }) {
    this.joinRoom(client, payload.chatId);
  }

  /**
   * 🔒 Dashboard Hook: Fired when an agent joins the interface to take over
   */
  @SubscribeMessage('agent_join')
  handleAgentJoin(client: any, payload: { chatId: string }) {
    const { chatId } = payload;
    this.hijackedChats.add(chatId);
    this.joinRoom(client, chatId);

    console.log(`🚨 Live operator hijacked chat ID: ${chatId}. Sarah is now muted.`);

    // Broadcast system warning event notice into the specific room
    this.broadcastToRoom(chatId, {
      event: 'system_message',
      data: '🔒 A live logistics specialist has joined the conversation.',
    });
  }

  /**
   * Handle standard chat messages
   */
  @SubscribeMessage('message')
  async handleMessage(client: any, payload: { event: string; data: { text: string; history: any[]; chatId?: string } }) {
    // Fallback to room tracker if chatId isn't explicitly passed in message payloads
    const chatId = payload.data.chatId || this.clientRooms.get(client);
    
    if (!chatId) {
      console.error('⚠️ Message arrived without an associated or trackable chatId.');
      return;
    }

    const userText = payload.data.text;
    const history = payload.data.history || [];

    // 1. Broadcast the incoming user text out to all spectators (dashboard monitoring pane)
    this.broadcastToRoom(chatId, {
      event: 'msg_receive',
      data: { role: 'user', content: userText },
    });

    // 2. Check if Sarah is silenced by a human operator
    if (this.hijackedChats.has(chatId)) {
      console.log(`🤫 Sarah remains quiet for room ${chatId} -- agent is currently handling.`);
      return; 
    }

    // 3. Fallback: No human agent is attached -> Let your core model evaluate and reply
    try {
      const aiReply = await this.voiceService.generateTextOnlyResponse(userText, history);
      
      this.broadcastToRoom(chatId, {
        event: 'ai_response',
        data: aiReply,
      });
    } catch (err) {
      console.error('❌ Failed processing automated text chat response:', err);
    }
  }

  /**
   * 👑 Dashboard Agent Outbound Message Response Handler
   */
  @SubscribeMessage('agent_message')
  handleAgentMessage(client: any, payload: { chatId: string; text: string }) {
    const { chatId, text } = payload;

    console.log(`✍️ Agent sending text to room ${chatId}: ${text}`);

    // Direct relay payload straight onto the website client widget instance
    this.broadcastToRoom(chatId, {
      event: 'ai_response', // Sending as ai_response ensures the widget drops it right into bubbles
      data: text,
    });
  }

  // --- PRIVATE UTILITY HELPERS ---

private joinRoom(client: any, chatId: string) {
  this.clientRooms.set(client, chatId);
  if (!this.rooms.has(chatId)) {
    this.rooms.set(chatId, new Set());
  }
  this.rooms.get(chatId)!.add(client);
}

  private broadcastToRoom(chatId: string, messageObj: any) {
    const targets = this.rooms.get(chatId);
    if (!targets) return;

    const stringifiedMessage = JSON.stringify(messageObj);
    targets.forEach((wsClient) => {
      if (wsClient.readyState === 1) { 
        wsClient.send(stringifiedMessage);
      }
    });
  }
}