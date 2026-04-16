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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallSchema = exports.Call = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let Call = class Call extends mongoose_2.Document {
    businessId;
    patientPhone;
    patientName;
    summary;
    transcript;
    status;
    procedure;
    callSid;
    recordingUrl;
    callDuration;
    metadata;
    isFlagged;
};
exports.Call = Call;
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], Call.prototype, "businessId", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Call.prototype, "patientPhone", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Call.prototype, "patientName", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Call.prototype, "summary", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Call.prototype, "transcript", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['booked', 'inquiry', 'missed', 'forwarded'] }),
    __metadata("design:type", String)
], Call.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Call.prototype, "procedure", void 0);
__decorate([
    (0, mongoose_1.Prop)({ index: true }),
    __metadata("design:type", String)
], Call.prototype, "callSid", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], Call.prototype, "recordingUrl", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", Number)
], Call.prototype, "callDuration", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], Call.prototype, "metadata", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: false }),
    __metadata("design:type", Boolean)
], Call.prototype, "isFlagged", void 0);
exports.Call = Call = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Call);
exports.CallSchema = mongoose_1.SchemaFactory.createForClass(Call);
//# sourceMappingURL=call.schema.js.map