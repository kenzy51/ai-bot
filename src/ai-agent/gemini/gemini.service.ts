/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    // @ts-ignore
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      systemInstruction: "You are an AI assistant for Tribeca Dental Studio. Your name is Maya. Your goal is to call new leads and tell them a manager will call back in 5 mins. Keep it brief.",
    });
  }

  async processAudio(base64Audio: string) {
    // В Gemini 2.0 Flash Multimodal Live API это работает через стримы
    // Для базового теста мы можем отправить аудио и получить текст (или аудио)
    const result = await this.model.generateContent([
      {
        inlineData: {
          mimeType: "audio/wav", // Twilio присылает mulaw, позже добавим конвертацию
          data: base64Audio
        }
      }
    ]);
    
    return result.response.text();
  }
}