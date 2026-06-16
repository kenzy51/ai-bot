
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ConfigStore {
  private configPath = path.join(process.cwd(), 'bot-config.json');

  // Default configuration structure
  private config = {
    knowledge: '',
    prompt: '',      // 💡 Primary Voice Prompt (Default)
    chatPrompt: '',  // 💡 Specialized Chat Prompt
    keywords: [] as string[],
    greeting: 'Hello, this is Sarah with TRT International. How can I help you today?',
  };

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileData = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(fileData);
        
        this.config = { ...this.config, ...parsed };
        console.log("✅ Sarah's Neural Architecture loaded.");
      }
    } catch (error) {
      console.error('❌ Failed to load bot-config.json:', error);
    }
  }

  /**
   * Updates the configuration. 
   * 'prompt' maps to the Voice Agent by default.
   * 'chatPrompt' maps to the Web Chatbot specifically.
   */
  updateConfig(data: {
    knowledge: string;
    prompt: string;     
    chatPrompt: string;
    keywords: string;
    greeting: string;
  }) {
    this.config.knowledge = data.knowledge;
    this.config.prompt = data.prompt;
    this.config.chatPrompt = data.chatPrompt;
    this.config.greeting = data.greeting;
    
    this.config.keywords = data.keywords
      .split(',')
      .map((k) => k.replace(/['"]+/g, '').trim())
      .filter((k) => k !== '');

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      console.log('💾 Neural layers synchronized to disk.');
    } catch (error) {
      console.error('❌ Sync Failed:', error);
    }
  }

  // --- ACCESSORS ---

  /** Returns the main prompt (Voice Agent) */
  getVoicePrompt() {
    return this.config.prompt || '';
  }

  /** Returns the specialized chat prompt (Web Widget) */
  getChatPrompt() {
    return this.config.chatPrompt || '';
  }

  getKnowledge() {
    return this.config.knowledge || '';
  }

  getKeywords() {
    return this.config.keywords || [];
  }

  getGreeting() {
    return this.config.greeting || 'Hello, this is Sarah.';
  }
}
