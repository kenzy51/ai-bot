import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ActiveTenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user.tenantId; // Достаем id компании, который guard вытащил из JWT
  },
);