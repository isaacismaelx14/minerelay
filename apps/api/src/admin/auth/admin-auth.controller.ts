import { Body, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminLoginDto } from '../admin.dto';
import { AdminApiController } from '../admin-api.controller.decorator';
import { AdminPublic } from '../admin-auth.decorator';
import { AdminAuthContextService } from './admin-auth-context.service';

@AdminApiController()
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthContextService) {}

  @Post('/v1/admin/auth/login')
  @AdminPublic()
  @Throttle({ admin_auth: { limit: 10, ttl: 300000 } })
  login(
    @Body() payload: AdminLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.login(payload.password, request, response);
  }

  @Post('/v1/admin/auth/refresh')
  @AdminPublic()
  @Throttle({ admin_auth: { limit: 20, ttl: 60000 } })
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.refresh(request, response);
  }

  @Post('/v1/admin/auth/logout')
  @Throttle({ admin_auth: { limit: 20, ttl: 60000 } })
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.logout(request, response);
  }
}
