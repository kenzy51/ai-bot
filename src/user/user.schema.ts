import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  // 🔒 Теперь required: false, потому что у SUPER_ADMIN нет привязки к одному тенанту!
  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: 'Tenant', 
    required: false, 
    index: true 
  })
  tenantId?: string; // Опционально для супер-админа, обязательно для остальных

  @Prop({ required: true, unique: true, index: true })
  username: string;

  @Prop({ required: true })
  password: string; 

  @Prop({ 
    required: true, 
    enum: ['SUPER_ADMIN', 'ADMIN', 'VIEWER'], 
    default: 'ADMIN' 
  })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);