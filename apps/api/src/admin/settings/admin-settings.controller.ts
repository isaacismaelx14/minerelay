import { Body, Delete, Get, Patch, Query } from '@nestjs/common';
import { SaveDraftDto, UpdateSettingsDto } from '../admin.dto';
import { AdminApiController } from '../admin-api.controller.decorator';
import { AdminSettingsContextService } from './admin-settings-context.service';

@AdminApiController()
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsContextService) {}

  @Get('/v1/admin/bootstrap')
  getBootstrap(@Query('includeLoaders') includeLoaders = '') {
    return this.settings.getBootstrap(includeLoaders === 'true');
  }

  @Patch('/v1/admin/settings')
  updateSettings(@Body() payload: UpdateSettingsDto) {
    return this.settings.updateSettings(payload);
  }

  @Patch('/v1/admin/draft')
  saveDraft(@Body() payload: SaveDraftDto) {
    return this.settings.saveDraft(payload);
  }

  @Delete('/v1/admin/draft')
  discardDraft() {
    return this.settings.discardDraft();
  }
}
