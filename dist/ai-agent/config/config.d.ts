export declare class ConfigStore {
    private configPath;
    private config;
    constructor();
    private loadConfig;
    updateConfig(knowledge: string, keywords: string, greeting: string): void;
    getKnowledge(): string;
    getKeywords(): string[];
    getGreeting(): string;
}
