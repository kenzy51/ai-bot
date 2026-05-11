export declare class ConfigStore {
    private configPath;
    private config;
    constructor();
    private loadConfig;
    updateConfig(knowledge: string, keywords: string, greeting: string, prompt: string): void;
    getPrompt(): string;
    getKnowledge(): string;
    getKeywords(): string[];
    getGreeting(): string;
}
