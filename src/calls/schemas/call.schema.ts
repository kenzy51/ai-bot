import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Call extends Document {
  @Prop({ required: true, index: true })
  businessId: string; // Linking this call to a specific clinic (Tribeca, etc.)

  @Prop()
  patientPhone: string;

  @Prop()
  patientName: string; // Megan should try to ask for this!

  @Prop()
  summary: string; // The AI-generated 1-sentence summary

  @Prop()
  transcript: string; // The full text of the conversation

  @Prop({ enum: ['booked', 'inquiry', 'missed', 'forwarded'] })
  status: string;

  @Prop()
  procedure: string;

  @Prop({ index: true })
  callSid: string;

  @Prop()
  recordingUrl: string; // The URL to the stored recording

  @Prop()
  callDuration: number; // Seconds (e.g., 120). Tells you how long the AI keeps people engaged.

  @Prop({ type: Object })
  metadata: {
    latency: number;
    modelUsed: string;
  };

  @Prop({ default: false })
  isFlagged: boolean;
}

export const CallSchema = SchemaFactory.createForClass(Call);
