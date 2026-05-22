import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async createUser(tenantId: string, username: string, cleartextPassword: string, role: string = 'ADMIN') {
    const exists = await this.userModel.findOne({ username }).exec();
    if (exists) {
      throw new BadRequestException('Username already taken');
    }

    const hashedPassword = await bcrypt.hash(cleartextPassword, 12);

    const newUser = new this.userModel({
      tenantId,
      username,
      password: hashedPassword,
      role,
    });

    const savedUser = await newUser.save();
    return { id: savedUser._id, username: savedUser.username, role: savedUser.role };
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }
}