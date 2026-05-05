export declare class ConfigStore {
    private configPath;
    private config;
    constructor();
    private loadConfig;
    updateConfig(knowledge: string, keywords: any, greeting: string): void;
    getKnowledge(): string;
    getKeywords(): never[];
    getGreeting(): string;
}
