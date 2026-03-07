import {
  applyDecorators,
  Controller,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AdminSessionGuard } from './admin.guard';
import { AdminCsrfGuard } from './auth/admin-csrf.guard';
import { AdminExceptionFilter } from './common/admin-exception.filter';

export function AdminApiController(): ClassDecorator {
  return applyDecorators(
    ApiTags('admin'),
    Throttle({ admin_api: { limit: 180, ttl: 60000 } }),
    UseGuards(AdminSessionGuard, AdminCsrfGuard),
    UseFilters(AdminExceptionFilter),
    Controller(),
  );
}
