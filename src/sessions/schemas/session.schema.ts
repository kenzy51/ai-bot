import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class ChatSession extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenantId: string; // Links this conversation safely to a specific business tenant

  @Prop({ required: true, index: true })
  sessionId: string; // Replaces callSid — used to track the unique socket/web conversation thread

  @Prop()
  endUserIp: string; // Replaces patientPhone — great for geo-analytics or spam detection

  @Prop()
  endUserName: string; // Replaces patientName — captured if the bot asks "What's your name?"

  @Prop()
  endUserEmail: string; // 🎯 NEW FEATURE: Highly useful for B2B chatbots capturing leads!

  @Prop()
  summary: string; // The AI-generated brief conversation summary

  @Prop()
  transcript: string; // The full text transcript of the chat exchange

  @Prop({ enum: ['active', 'completed', 'abandoned', 'human_escalated'], default: 'active' })
  status: string; // Replaces voice statuses with web chat lifecycles

  @Prop({ type: Object })
  metadata: {
    totalTokensUsed: number; // 🧠 SYSTEMS DESIGN BONUS: Tracks cost efficiency metrics per tenant
    modelUsed: string;
    originDomain: string; // Tracks which website domain the message came from (security auditing)
  };

  @Prop({ default: false })
  isFlagged: boolean;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);