export declare class ConfigStore {
    private configPath;
    private config;
    constructor();
    private loadConfig;
    updateConfig(data: {
        knowledge: string;
        prompt: string;
        chatPrompt: string;
        keywords: string;
        greeting: string;
    }): void;
    getVoicePrompt(): string;
    getChatPrompt(): string;
    getKnowledge(): string;
    getKeywords(): string[];
    getGreeting(): string;
}
