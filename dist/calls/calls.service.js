"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const call_schema_1 = require("./schemas/call.schema");
let CallsService = class CallsService {
    callModel;
    constructor(callModel) {
        this.callModel = callModel;
    }
    async saveCall(callData) {
        return await this.callModel.findOneAndUpdate({ callSid: callData.callSid }, { $set: callData }, { upsert: true, new: true }).exec();
    }
    async updateCallRecording(callSid, recordingUrl) {
        console.log(`📡 WEBHOOK HIT for SID: ${callSid}`);
        const update = await this.callModel.findOneAndUpdate({ callSid: callSid }, { $set: { recordingUrl: recordingUrl } }, { upsert: true, new: true }).exec();
        console.log("💾 Database updated:", update);
        return update;
    }
    async getHistoryByBusiness(businessId) {
        return this.callModel
            .find({ businessId })
            .sort({ createdAt: -1 })
            .limit(50)
            .exec();
    }
};
exports.CallsService = CallsService;
exports.CallsService = CallsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(call_schema_1.Call.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], CallsService);
//# sourceMappingURL=calls.service.js.map