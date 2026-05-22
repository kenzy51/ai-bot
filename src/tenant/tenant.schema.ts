import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
class VoiceConfig {
  @Prop({ required: true, default: 'PBZ6PhGMbBIzGFQBGF5u' })
  voiceId: string;

  @Prop({ required: true })
  greeting: string;

  @Prop({ required: true })
  voicePrompt: string;

  @Prop({ required: true })
  chatPrompt: string;

  @Prop({ required: true })
  knowledgeBase: string;

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: Object, default: {} })
  departments: Record<string, string>;
}

@Schema({ timestamps: true })
export class Tenant extends Document {
  @Prop({ required: true, unique: true, index: true })
  slug: string; 

  @Prop({ required: true })
  name: string;

  @Prop({ type: VoiceConfig, required: true })
  voiceConfig: VoiceConfig;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);