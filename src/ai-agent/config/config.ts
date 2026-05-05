import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ConfigStore {
  private configPath = path.join(process.cwd(), 'bot-config.json');
  private config = {
    knowledge: '',
    keywords: [],
    greeting:
      'Hello, this is Sarah with TRT International. How can I help you move freight today?',
  };

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    if (fs.existsSync(this.configPath)) {
      this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
    }
  }

  updateConfig(knowledge: string, keywords: any, greeting: string) {
    this.config.knowledge = knowledge;
    this.config.keywords = keywords
      .split(',')
      .map((k) => k.replace(/['"]+/g, '').trim()) // This removes any accidental quotes
      .filter((k) => k !== ''); // Removes empty strings

    this.config.greeting = greeting;
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  getKnowledge() {
    return this.config.knowledge;
  }
  getKeywords() {
    return this.config.keywords;
  }
  getGreeting() {
    return this.config.greeting;
  }
}
