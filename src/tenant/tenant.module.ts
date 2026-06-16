import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantService } from './tenant.service';
import { Tenant, TenantSchema } from './tenant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }]),
  ],
  providers: [TenantService],
  exports: [TenantService, MongooseModule]
})
export class TenantModule {}