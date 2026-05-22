import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  // 1. Проверка подлинности учетных данных
  async validateUser(username: string, cleartextPassword: string): Promise<any> {
    const user = await this.userService.findByUsername(username);
    if (user && (await bcrypt.compare(cleartextPassword, user.password))) {
      // Исключаем пароль из возвращаемого объекта для безопасности
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  // 2. Вшивание ролей и тенанта в JWT-токен при успешном входе
  async login(user: any) {
    const payload = {
      username: user.username,
      sub: user._id,
      role: user.role, // Твои роли: SUPER_ADMIN, ADMIN, VIEWER
      tenantId: user.tenantId || null, // Для тебя (SUPER_ADMIN) тут будет null
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        username: user.username,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }
}