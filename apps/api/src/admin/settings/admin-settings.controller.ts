import { Body, Delete, Get, Patch, Query } from '@nestjs/common';
import { SaveDraftDto, UpdateSettingsDto } from '../admin.dto';
import { AdminApiController } from '../admin-api.controller.decorator';
import { AdminSettingsContextService } from './admin-settings-context.service';

@AdminApiController()
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsContextService) {}

  @Get('/admin/bootstrap')
  getBootstrap(@Query('includeLoaders') includeLoaders = '') {
    return this.settings.getBootstrap(includeLoaders === 'true');
  }

  @Patch('/admin/settings')
  updateSettings(@Body() payload: UpdateSettingsDto) {
    return this.settings.updateSettings(payload);
  }

  @Patch('/admin/draft')
  saveDraft(@Body() payload: SaveDraftDto) {
    return this.settings.saveDraft(payload);
  }

  @Delete('/admin/draft')
  discardDraft() {
    return this.settings.discardDraft();
  }
}
