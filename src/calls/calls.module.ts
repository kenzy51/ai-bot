import { Module } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Call, CallSchema } from './schemas/call.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }])
  ],
  providers: [CallsService],
  controllers: [CallsController],
  exports:[
    CallsService
  ]
})
export class CallsModule {}
