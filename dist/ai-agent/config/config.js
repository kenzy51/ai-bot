"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigStore = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let ConfigStore = class ConfigStore {
    configPath = path.join(process.cwd(), 'bot-config.json');
    config = {
        knowledge: '',
        prompt: '',
        chatPrompt: '',
        keywords: [],
        greeting: 'Hello, this is Sarah with TRT International. How can I help you today?',
    };
    constructor() {
        this.loadConfig();
    }
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const fileData = fs.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(fileData);
                this.config = { ...this.config, ...parsed };
                console.log("✅ Sarah's Neural Architecture loaded.");
            }
        }
        catch (error) {
            console.error('❌ Failed to load bot-config.json:', error);
        }
    }
    updateConfig(data) {
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
        }
        catch (error) {
            console.error('❌ Sync Failed:', error);
        }
    }
    getVoicePrompt() {
        return this.config.prompt || '';
    }
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
};
exports.ConfigStore = ConfigStore;
exports.ConfigStore = ConfigStore = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ConfigStore);
//# sourceMappingURL=config.js.map