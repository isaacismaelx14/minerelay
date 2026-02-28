import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { GenerateLockfileDto } from './admin.dto';
import { renderAdminPage } from './admin.page';
import { renderAdminScript } from './admin.script';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('/admin')
  getAdminPage(@Res() response: Response) {
    response.type('html').send(renderAdminPage());
  }

  @Get('/admin/app.js')
  getAdminScript(@Res() response: Response) {
    response.type('application/javascript').send(renderAdminScript());
  }

  @Get('/v1/admin/mods/search')
  searchMods(
    @Query('query') query = '',
    @Query('minecraftVersion') minecraftVersion = '',
  ) {
    return this.adminService.searchMods(query, minecraftVersion);
  }

  @Get('/v1/admin/mods/resolve')
  resolveMod(
    @Query('projectId') projectId = '',
    @Query('minecraftVersion') minecraftVersion = '',
  ) {
    return this.adminService.resolveCompatibleMod(projectId, minecraftVersion);
  }

  @Post('/v1/admin/lockfile/generate')
  generateLockfile(
    @Body() payload: GenerateLockfileDto,
    @Req() request: Request,
  ) {
    const origin = `${request.protocol}://${request.get('host') ?? 'localhost:3000'}`;
    return this.adminService.generateLockfile(payload, origin);
  }
}
