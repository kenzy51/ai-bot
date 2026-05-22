import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant } from './tenant.schema';

@Injectable()
export class TenantService {
  constructor(
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
  ) {}

  // 🏢 1. Создание нового клиента/салона в системе
  async createTenant(slug: string, name: string) {
    const exists = await this.tenantModel.findOne({ slug }).exec();
    if (exists) {
      throw new BadRequestException('Tenant with this slug already exists');
    }

    const newTenant = new this.tenantModel({
      slug,
      name,
      voiceConfig: {
        voiceId: 'PBZ6PhGMbBIzGFQBGF5u', // Дефолтный ID голоса
        greeting: `Hello, thank you for calling ${name}. How can I assist you today?`,
        voicePrompt: `You are a helpful AI assistant for ${name}.`,
        chatPrompt: `You are a web chat assistant for ${name}.`,
        knowledgeBase: 'Initial knowledge base matrix.',
        keywords: [],
        departments: {},
      },
    });

    return await newTenant.save();
  }

  // 🔍 2. Получение конфига для ядра ИИ во время живого звонка
  async getBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantModel.findOne({ slug }).exec();
  }
}