import { calendar_v3 } from 'googleapis';
export declare class GoogleCalendarService {
    private calendar;
    private readonly logger;
    constructor();
    isSlotAvailable(start: string, end: string): Promise<boolean>;
    createBooking(patientName: string, start: string, end: string): Promise<calendar_v3.Schema$Event>;
}
