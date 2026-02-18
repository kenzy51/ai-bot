import { Injectable, Logger } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';

@Injectable()
export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar;
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor() {
    try {
      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      this.calendar = google.calendar({ version: 'v3', auth });
      this.logger.log('📅 Google Calendar Service Initialized');
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize Google Calendar Auth',
        error.stack,
      );
    }
  }

  // Check if a specific time is available
  async isSlotAvailable(start: string, end: string): Promise<boolean> {
    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: start, // Example: "2026-02-13T14:00:00Z"
          timeMax: end,
          items: [{ id: 'primary' }],
        },
      });

      const busySlots = response.data.calendars?.primary?.busy || [];
      return busySlots.length === 0;
    } catch (error) {
      this.logger.error('❌ Error checking availability', error.message);
      return false; // Assume busy if API fails to prevent double booking
    }
  }

  // Create the actual event
  async createBooking(patientName: string, start: string, end: string) {
    try {
      const event: calendar_v3.Schema$Event = {
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
        // Adds a color to the event so the dentist sees it's from the AI
        colorId: '5',
      };

      const result = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      this.logger.log(`✅ Appointment created: ${result.data.htmlLink}`);
      return result.data;
    } catch (error) {
      this.logger.error('❌ Error creating booking', error.message);
      throw new Error('Could not create calendar event');
    }
  }
}
