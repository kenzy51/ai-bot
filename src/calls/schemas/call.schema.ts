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
  status: string; // Tells the CEO if Megan made money or just answered questions

  @Prop()
  procedure: string; // e.g., "NightLase", "Cleaning"
}

export const CallSchema = SchemaFactory.createForClass(Call);