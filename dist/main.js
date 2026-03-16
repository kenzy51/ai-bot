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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const platform_ws_1 = require("@nestjs/platform-ws");
const promises_1 = __importDefault(require("node:dns/promises"));
promises_1.default.setServers(['8.8.8.8', '8.8.4.4']);
async function bootstrap() {
    console.log(process.memoryUsage());
    console.log('Initial Memory:', process.memoryUsage().rss / 1024 / 1024, 'MB');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    setInterval(() => {
        const mem = process.memoryUsage();
        const format = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';
        console.log(`--- Memory Usage ---`);
        console.log(`RSS (Total): ${format(mem.rss)}`);
        console.log(`Heap Total:  ${format(mem.heapTotal)}`);
        console.log(`Heap Used:   ${format(mem.heapUsed)}`);
        console.log(`External:    ${format(mem.external)}`);
    }, 10000);
    console.log('Post-Init Memory:', process.memoryUsage().rss / 1024 / 1024, 'MB');
    app.enableCors();
    app.useWebSocketAdapter(new platform_ws_1.WsAdapter(app));
    await app.listen(3003);
}
bootstrap();
//# sourceMappingURL=main.js.map