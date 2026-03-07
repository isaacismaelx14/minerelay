import { ManagedMod } from '../core-mod-policy.service';
import {
  ManagedResourcePack,
  ManagedShaderPack,
} from '../mods/admin-mods-context.service';

export type DraftPayload = {
  serverName: string | null;
  serverAddress: string | null;
  profileId: string | null;
  minecraftVersion: string | null;
  loaderVersion: string | null;
  mods: ManagedMod[] | null;
  resources: ManagedResourcePack[] | null;
  shaders: ManagedShaderPack[] | null;
  fancyMenu: {
    enabled: boolean;
    mode: 'simple' | 'custom';
    playButtonLabel: string;
    hideSingleplayer: boolean;
    hideMultiplayer: boolean;
    hideRealms: boolean;
    customLayoutUrl?: string;
    customLayoutSha256?: string;
  } | null;
  branding: {
    serverName: string;
    logoUrl?: string;
    backgroundUrl?: string;
    newsUrl?: string;
  } | null;
};
