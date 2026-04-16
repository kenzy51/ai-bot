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
var GoogleCalendarService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCalendarService = void 0;
const common_1 = require("@nestjs/common");
const googleapis_1 = require("googleapis");
let GoogleCalendarService = GoogleCalendarService_1 = class GoogleCalendarService {
    calendar;
    logger = new common_1.Logger(GoogleCalendarService_1.name);
    constructor() {
        try {
            const auth = new googleapis_1.google.auth.JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                scopes: ['https://www.googleapis.com/auth/calendar'],
            });
            this.calendar = googleapis_1.google.calendar({ version: 'v3', auth });
            this.logger.log('📅 Google Calendar Service Initialized');
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize Google Calendar Auth', error.stack);
        }
    }
    async isSlotAvailable(start, end) {
        try {
            const response = await this.calendar.freebusy.query({
                requestBody: {
                    timeMin: start,
                    timeMax: end,
                    items: [{ id: 'primary' }],
                },
            });
            const busySlots = response.data.calendars?.primary?.busy || [];
            return busySlots.length === 0;
        }
        catch (error) {
            this.logger.error('❌ Error checking availability', error.message);
            return false;
        }
    }
    async createBooking(patientName, start, end) {
        try {
            const event = {
                summary: `Booking: ${patientName}`,
                description: 'Scheduled by Fusion AI Bot (Maya)',
                start: {
                    dateTime: start,
                    timeZone: 'America/New_York',
                },
                end: {
                    dateTime: end,
                    timeZone: 'America/New_York',
                },
                colorId: '5',
            };
            const result = await this.calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
            });
            this.logger.log(`✅ Appointment created: ${result.data.htmlLink}`);
            return result.data;
        }
        catch (error) {
            this.logger.error('❌ Error creating booking', error.message);
            throw new Error('Could not create calendar event');
        }
    }
};
exports.GoogleCalendarService = GoogleCalendarService;
exports.GoogleCalendarService = GoogleCalendarService = GoogleCalendarService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], GoogleCalendarService);
//# sourceMappingURL=google-calendar.service.js.map