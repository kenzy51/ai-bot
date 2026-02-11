/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as WebSocket from 'ws';

@Injectable()
export class GeminiService {
  connectToGemini() {
    // 1. Using v1beta is correct for Bidi
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const ws = new WebSocket.WebSocket(url);

  ws.on('open', () => {
  const setupConfig = {
    setup: {
      // Corrected model ID for the Live API
      model: "models/gemini-live-2.5-flash-native-audio", 
      generation_config: {
        response_modalities: ["AUDIO"],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: "Aoede" // Choose from: Puck, Charon, Kore, Fenrir, Aoede
            }
          }
        }
      }
    }
  };
  ws.send(JSON.stringify(setupConfig));
});

    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());

        if (response.setupComplete) {
          console.log('💎 Gemini Setup Complete!');
          
          // 3. SEND SYSTEM INSTRUCTIONS AS A FIRST TURN
          // Some versions of the Live API prefer system instructions here 
          // rather than inside the setup block to avoid 1007 errors.
          const firstTurn = {
            client_content: {
              turns: [{
                role: "user",
                parts: [{ text: "Your name is Maya. You are a dental assistant at Tribeca Dental Studio. Greet the patient." }]
              }],
              turn_complete: true
            }
          };
          ws.send(JSON.stringify(firstTurn));
        }

        if (response.error) {
          console.error('❌ Gemini Error Object:', JSON.stringify(response.error, null, 2));
        }
      } catch (err) {
        console.error('Parsing error:', err);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 Gemini closed. Code: ${code}, Reason: ${reason.toString()}`);
    });

    return ws;
  }
}