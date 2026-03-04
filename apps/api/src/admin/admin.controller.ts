import {
  Body,
  Controller,
  Delete,
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
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import {
  AdminLoginDto,
  ConnectExarotonDto,
  ExarotonServerActionDto,
  SelectExarotonServerDto,
  GenerateLockfileDto,
  InstallModDto,
  PublishProfileDto,
  SaveDraftDto,
  UpdateSettingsDto,
} from './admin.dto';
import { readAdminScript, readLoginScript } from './admin.assets';
import { renderAdminPage, renderAdminLoginPage } from './admin.page';
import { AdminPublic } from './admin-auth.decorator';
import { AdminSessionGuard } from './admin.guard';
import { AdminCsrfGuard } from './auth/admin-csrf.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Throttle({ admin_api: { limit: 180, ttl: 60000 } })
@UseGuards(AdminSessionGuard, AdminCsrfGuard)
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
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.type('application/javascript').send(readLoginScript());
  }

  @Post('/v1/admin/auth/login')
  @AdminPublic()
  @Throttle({ admin_auth: { limit: 10, ttl: 300000 } })
  login(
    @Body() payload: AdminLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.adminService.login(payload.password, request, response);
  }

  @Post('/v1/admin/auth/refresh')
  @AdminPublic()
  @Throttle({ admin_auth: { limit: 20, ttl: 60000 } })
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.adminService.refresh(request, response);
  }

  @Post('/v1/admin/auth/logout')
  @Throttle({ admin_auth: { limit: 20, ttl: 60000 } })
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
  getAdminScript(@Res() response: Response) {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.type('application/javascript').send(readAdminScript());
  }

  @Get('/v1/admin/bootstrap')
  getBootstrap() {
    return this.adminService.getBootstrap();
  }

  @Patch('/v1/admin/settings')
  updateSettings(@Body() payload: UpdateSettingsDto) {
    return this.adminService.updateSettings(payload);
  }

  @Patch('/v1/admin/draft')
  saveDraft(@Body() payload: SaveDraftDto) {
    return this.adminService.saveDraft(payload);
  }

  @Post('/v1/admin/exaroton/connect')
  connectExaroton(@Body() payload: ConnectExarotonDto) {
    return this.adminService.connectExaroton(payload.apiKey);
  }

  @Delete('/v1/admin/exaroton/disconnect')
  disconnectExaroton() {
    return this.adminService.disconnectExaroton();
  }

  @Get('/v1/admin/exaroton/status')
  getExarotonStatus() {
    return this.adminService.getExarotonStatus();
  }

  @Get('/v1/admin/exaroton/servers')
  listExarotonServers() {
    return this.adminService.listExarotonServers();
  }

  @Post('/v1/admin/exaroton/server/select')
  selectExarotonServer(@Body() payload: SelectExarotonServerDto) {
    return this.adminService.selectExarotonServer(payload.serverId);
  }

  @Post('/v1/admin/exaroton/server/action')
  exarotonServerAction(@Body() payload: ExarotonServerActionDto) {
    return this.adminService.exarotonServerAction(payload.action);
  }

  @Get('/v1/admin/exaroton/server/stream')
  async exarotonServerStream(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let closeUpstream: (() => void) | null = null;
    const heartbeat = setInterval(() => {
      send('ping', { ts: Date.now() });
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      if (closeUpstream) {
        closeUpstream();
        closeUpstream = null;
      }
      if (!res.writableEnded) {
        res.end();
      }
    };

    req.on('close', cleanup);

    try {
      closeUpstream = await this.adminService.openExarotonStatusStream({
        onStatus: (server) => send('status', { selectedServer: server }),
        onError: (message) => send('stream-error', { message }),
      });
      send('ready', { ok: true });
    } catch (error) {
      send('stream-error', {
        message:
          (error as Error).message || 'Failed to open Exaroton status stream',
      });
      cleanup();
    }
  }

  @Get('/v1/admin/fabric/versions')
  getFabricVersions(@Query('minecraftVersion') minecraftVersion = ''): Promise<{
    minecraftVersion: string;
    loaders: Array<{ version: string; stable: boolean }>;
    latestStable: string | null;
  }> {
    return this.adminService.getFabricVersions(minecraftVersion);
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
    @Query('versionId') versionId = '',
  ) {
    return this.adminService.resolveCompatibleMod(
      projectId,
      minecraftVersion,
      versionId || undefined,
    );
  }

  @Get('/v1/admin/mods/analyze')
  analyzeMod(
    @Query('projectId') projectId = '',
    @Query('minecraftVersion') minecraftVersion = '',
  ) {
    return this.adminService.analyzeModDependencies(
      projectId,
      minecraftVersion,
    );
  }

  @Get('/v1/admin/mods/versions')
  getModVersions(
    @Query('projectId') projectId = '',
    @Query('minecraftVersion') minecraftVersion = '',
  ) {
    return this.adminService.getModVersions(projectId, minecraftVersion);
  }

  @Post('/v1/admin/mods/install')
  installMod(@Body() payload: InstallModDto) {
    return this.adminService.installMod(payload);
  }

  @Post('/v1/admin/lockfile/generate')
  generateLockfile(@Body() payload: GenerateLockfileDto) {
    return this.adminService.generateLockfile(payload);
  }

  @Post('/v1/admin/profile/publish')
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
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadMedia(
    @UploadedFile()
    file: {
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

  @Post('/v1/admin/fancymenu/bundle/upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadFancyMenuBundle(
    @UploadedFile()
    file: {
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
    return this.adminService.uploadFancyMenuBundle(file, origin);
  }
}
