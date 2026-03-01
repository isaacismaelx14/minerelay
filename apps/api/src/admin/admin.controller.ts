import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import {
  AdminLoginDto,
  GenerateLockfileDto,
  InstallModDto,
  PublishProfileDto,
  SaveDraftDto,
  UpdateSettingsDto,
} from './admin.dto';
import { renderAdminPage, renderAdminLoginPage } from './admin.page';
import { renderAdminScript, renderLoginScript } from './admin.script';
import { renderLegacyAdminPage } from './admin.legacy.page';
import { renderLegacyAdminScript } from './admin.legacy.script';
import { AdminPublic } from './admin-auth.decorator';
import { AdminSessionGuard } from './admin.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('/admin/login')
  @AdminPublic()
  async getLoginPage(@Req() request: Request, @Res() response: Response) {
    const isAuthenticated =
      await this.adminService.authenticateRequest(request);
    if (isAuthenticated) {
      response.redirect('/admin');
      return;
    }

    response.type('html').send(renderAdminLoginPage());
  }

  @Get('/admin/login/app.js')
  @AdminPublic()
  getLoginScript(@Res() response: Response) {
    response.type('application/javascript').send(renderLoginScript());
  }

  @Post('/v1/admin/auth/login')
  @AdminPublic()
  login(
    @Body() payload: AdminLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.adminService.login(payload.password, request, response);
  }

  @Post('/v1/admin/auth/refresh')
  @AdminPublic()
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.adminService.refresh(request, response);
  }

  @Post('/v1/admin/auth/logout')
  @AdminPublic()
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.adminService.logout(request, response);
  }

  @Get('/admin')
  @AdminPublic()
  async getAdminPage(@Req() request: Request, @Res() response: Response) {
    const isAuthenticated =
      await this.adminService.authenticateRequest(request);
    if (!isAuthenticated) {
      response.redirect('/admin/login');
      return;
    }

    response.type('html').send(renderAdminPage());
  }

  @Get('/admin/app.js')
  @UseGuards(AdminSessionGuard)
  getAdminScript(@Res() response: Response) {
    response.type('application/javascript').send(renderAdminScript());
  }

  @Get('/admin/legacy')
  @AdminPublic()
  async getLegacyAdminPage(@Req() request: Request, @Res() response: Response) {
    const isAuthenticated =
      await this.adminService.authenticateRequest(request);
    if (!isAuthenticated) {
      response.redirect('/admin/login');
      return;
    }

    response.type('html').send(renderLegacyAdminPage());
  }

  @Get('/admin/legacy/app.js')
  @UseGuards(AdminSessionGuard)
  getLegacyAdminScript(@Res() response: Response) {
    response.type('application/javascript').send(renderLegacyAdminScript());
  }

  @Get('/v1/admin/bootstrap')
  @UseGuards(AdminSessionGuard)
  getBootstrap() {
    return this.adminService.getBootstrap();
  }

  @Patch('/v1/admin/settings')
  @UseGuards(AdminSessionGuard)
  updateSettings(@Body() payload: UpdateSettingsDto) {
    return this.adminService.updateSettings(payload);
  }

  @Patch('/v1/admin/draft')
  @UseGuards(AdminSessionGuard)
  saveDraft(@Body() payload: SaveDraftDto) {
    return this.adminService.saveDraft(payload);
  }

  @Get('/v1/admin/fabric/versions')
  @UseGuards(AdminSessionGuard)
  getFabricVersions(@Query('minecraftVersion') minecraftVersion = ''): Promise<{
    minecraftVersion: string;
    loaders: Array<{ version: string; stable: boolean }>;
    latestStable: string | null;
  }> {
    return this.adminService.getFabricVersions(minecraftVersion);
  }

  @Get('/v1/admin/mods/search')
  @UseGuards(AdminSessionGuard)
  searchMods(
    @Query('query') query = '',
    @Query('minecraftVersion') minecraftVersion = '',
  ) {
    return this.adminService.searchMods(query, minecraftVersion);
  }

  @Get('/v1/admin/mods/resolve')
  @UseGuards(AdminSessionGuard)
  resolveMod(
    @Query('projectId') projectId = '',
    @Query('minecraftVersion') minecraftVersion = '',
  ) {
    return this.adminService.resolveCompatibleMod(projectId, minecraftVersion);
  }

  @Get('/v1/admin/mods/analyze')
  @UseGuards(AdminSessionGuard)
  analyzeMod(
    @Query('projectId') projectId = '',
    @Query('minecraftVersion') minecraftVersion = '',
  ) {
    return this.adminService.analyzeModDependencies(
      projectId,
      minecraftVersion,
    );
  }

  @Post('/v1/admin/mods/install')
  @UseGuards(AdminSessionGuard)
  installMod(@Body() payload: InstallModDto) {
    return this.adminService.installMod(payload);
  }

  @Post('/v1/admin/lockfile/generate')
  @UseGuards(AdminSessionGuard)
  generateLockfile(@Body() payload: GenerateLockfileDto) {
    return this.adminService.generateLockfile(payload);
  }

  @Post('/v1/admin/profile/publish')
  @UseGuards(AdminSessionGuard)
  publishProfile(@Body() payload: PublishProfileDto, @Req() request: Request) {
    const host = request.get('host') ?? 'localhost:3000';
    const forwardedProto = request
      .get('x-forwarded-proto')
      ?.split(',')[0]
      ?.trim()
      ?.toLowerCase();
    const protocol =
      forwardedProto === 'https' || forwardedProto === 'http'
        ? forwardedProto
        : request.protocol;
    const origin = `${protocol}://${host}`;
    return this.adminService.publishProfile(payload, origin);
  }

  @Post('/v1/admin/media/upload')
  @UseGuards(AdminSessionGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadMedia(
    @UploadedFile() file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    @Req() request: Request,
  ) {
    const host = request.get('host') ?? 'localhost:3000';
    const forwardedProto = request
      .get('x-forwarded-proto')
      ?.split(',')[0]
      ?.trim()
      ?.toLowerCase();
    const protocol =
      forwardedProto === 'https' || forwardedProto === 'http'
        ? forwardedProto
        : request.protocol;
    const origin = `${protocol}://${host}`;
    return this.adminService.uploadMedia(file, origin);
  }
}
