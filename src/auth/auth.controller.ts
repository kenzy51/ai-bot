import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: any) {
    const user = await this.authService.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid cryptographic context credentials');
    }
    return this.authService.login(user);
  }
}