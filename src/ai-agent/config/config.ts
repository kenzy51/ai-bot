import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ConfigStore {
  private configPath = path.join(process.cwd(), 'bot-config.json');
  
  private config = {
    knowledge: '',
    keywords: [] as string[],
    greeting: 'Hello, this is Sarah with TRT International. How can I help you move freight today?',
  };

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileData = fs.readFileSync(this.configPath, 'utf-8');
        this.config = JSON.parse(fileData);
        console.log("✅ Sarah's brain loaded from disk.");
      }
    } catch (error) {
      console.error("❌ Failed to load bot-config.json:", error);
    }
  }

  updateConfig(knowledge: string, keywords: string, greeting: string) {
    // 1. Update the live in-memory object
    this.config.knowledge = knowledge;
    this.config.keywords = keywords
      .split(',')
      .map((k) => k.replace(/['"]+/g, '').trim())
      .filter((k) => k !== '');
    this.config.greeting = greeting;

    // 2. Save to disk so it persists across restarts
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      console.log("💾 Config saved to disk successfully.");
    } catch (error) {
      console.error("❌ Failed to save config:", error);
    }
  }

  // Ensure these are returning the LATEST values from 'this.config'
  getKnowledge() {
    return this.config.knowledge || "";
  }
  getKeywords() {
    return this.config.keywords || [];
  }
  getGreeting() {
    return this.config.greeting || "Hello, this is Sarah.";
  }
}