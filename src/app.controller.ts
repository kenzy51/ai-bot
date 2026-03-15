import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  // app.controller.ts
  @Get('debug-audio')
  async debugAudio(@Res() res: any) {
    console.log('🔥 DEBUG ROUTE HIT!');
    return res.send('DEBUG IS WORKING');
  }
}
