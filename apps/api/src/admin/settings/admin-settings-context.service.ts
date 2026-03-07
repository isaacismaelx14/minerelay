import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SaveDraftDto, UpdateSettingsDto } from '../admin.dto';
import { AdminAppSettingsStoreService } from './admin-app-settings-store.service';
import { AdminBootstrapAssemblerService } from './admin-bootstrap-assembler.service';
import { AdminDraftService } from './admin-draft.service';

@Injectable()
export class AdminSettingsContextService {
  constructor(
    private readonly config: ConfigService,
    private readonly appSettingsStore: AdminAppSettingsStoreService,
    private readonly bootstrap: AdminBootstrapAssemblerService,
    private readonly draft: AdminDraftService,
  ) {}

  getBootstrap(includeLoaders = false) {
    return this.bootstrap.getBootstrap(this.getServerId(), includeLoaders);
  }

  updateSettings(input: UpdateSettingsDto) {
    return this.appSettingsStore.updateSettings(input, this.getServerId());
  }

  saveDraft(input: SaveDraftDto) {
    return this.draft.saveDraft(input, this.getServerId());
  }

  discardDraft() {
    return this.draft.discardDraft();
  }

  private getServerId() {
    return this.config.get<string>('SERVER_ID') ?? 'mvl';
  }
}
