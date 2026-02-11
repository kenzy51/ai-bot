/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { DeepgramClient, createClient } from "@deepgram/sdk";
import Groq from "groq-sdk";

@Injectable()
export class GeminiService {
  private deepgram: DeepgramClient;
  private groq: Groq;

  constructor() {
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  // Этот метод будет вызываться, когда Deepgram расшифрует фразу
  async generateResponse(userText: string) {
    console.log(`👤 Patient said: ${userText}`);
    
    const chatCompletion = await this.groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are Maya, a professional and friendly dental assistant at Tribeca Dental Studio in NYC. Keep answers very short (1-2 sentences). Your goal is to help patients with appointments."
        },
        { role: "user", content: userText }
      ],
      model: "llama-3.3-70b-versatile", // Очень быстрая и умная модель
      max_tokens: 100,
    });

    const aiResponse = chatCompletion.choices[0]?.message?.content || "";
    console.log(`🤖 Maya says: ${aiResponse}`);
    return aiResponse;
  }

  // Метод для создания стрима в Deepgram
 /* eslint-disable prettier/prettier */
getDeepgramLive() {
  return this.deepgram.listen.live({
    model: "nova-2-phonecall",
    language: "en-US",
    // Twilio присылает данные по 20мс, что соответствует 160 байтам в сыром виде, 
    // но в base64 это как раз около 216 байт.
    encoding: "mulaw",    
    sample_rate: 8000,    
    interim_results: true,
    endpointing: 300,
    smart_format: true,
  });
}
}