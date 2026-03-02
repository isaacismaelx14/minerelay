import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PropsWithChildren,
  type ReactElement,
} from 'react';
import { authFetch, requestJson, uploadForm } from './http';
import type {
  AdminMod,
  BootstrapPayload,
  BrandingPayload,
  CoreModPolicy,
  DependencyAnalysis,
  FabricVersionsPayload,
  FancyMenuPayload,
  FancyMenuPreviewPayload,
  InstallModsPayload,
  ModVersionsPayload,
  PublishPayload,
  SaveDraftPayload,
  SaveSettingsPayload,
  SearchResult,
  UploadBundlePayload,
  UploadImagePayload,
} from './types';

type StatusTone = 'idle' | 'ok' | 'error';

type StatusMessage = {
  text: string;
  tone: StatusTone;
};

type StatusState = {
  bootstrap: StatusMessage;
  draft: StatusMessage;
  settings: StatusMessage;
  mods: StatusMessage;
  publish: StatusMessage;
  fancy: StatusMessage;
};

type LoaderOption = {
  version: string;
  stable: boolean;
};

type FormState = {
  searchQuery: string;
  serverName: string;
  serverAddress: string;
  profileId: string;
  currentVersion: number;
  currentReleaseVersion: string;
  minecraftVersion: string;
  loaderVersion: string;
  supportedMinecraftVersions: string;
  brandingLogoUrl: string;
  brandingBackgroundUrl: string;
  brandingNewsUrl: string;
  fancyMenuEnabled: 'true' | 'false';
  fancyMenuMode: 'simple' | 'custom';
  playButtonLabel: string;
  hideSingleplayer: 'true' | 'false';
  hideMultiplayer: 'true' | 'false';
  hideRealms: 'true' | 'false';
  fancyMenuCustomLayoutUrl: string;
  fancyMenuCustomLayoutSha256: string;
};

type PendingInstall = {
  projectId: string;
  title: string;
  dependencies: Array<{ projectId: string; title: string }>;
};

type RailState = {
  minecraft: string;
  fabric: string;
  nextRelease: string;
};

type PublishSnapshot = {
  profileId: string;
  serverName: string;
  serverAddress: string;
  minecraftVersion: string;
  loaderVersion: string;
  fancyMenu: FancyMenuPayload;
  branding: BrandingPayload;
  mods: AdminMod[];
};

type AdminContextValue = {
  view: 'overview' | 'mods' | 'fancy';
  setView: (view: 'overview' | 'mods' | 'fancy') => void;
  form: FormState;
  setTextFieldFromEvent: (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  selectedMods: AdminMod[];
  coreModPolicy: CoreModPolicy;
  searchResults: SearchResult[];
  dependencyMap: Record<string, DependencyAnalysis>;
  pendingInstall: PendingInstall | null;
  modVersionOptions: Record<string, ModVersionsPayload['versions']>;
  loaderOptions: LoaderOption[];
  statuses: StatusState;
  sessionState: 'pending' | 'active';
  hasPendingPublish: boolean;
  rail: RailState;
  fancyPreview: FancyMenuPreviewPayload['model'] | null;
  fancyPreviewExpiresAt: string | null;
  isBusy: {
    bootstrap: boolean;
    search: boolean;
    publish: boolean;
    install: boolean;
    preview: boolean;
  };
  actions: {
    logout: () => Promise<void>;
    refreshLoaders: () => Promise<void>;
    searchMods: () => Promise<void>;
    requestInstall: (projectId: string) => Promise<void>;
    confirmInstall: () => Promise<void>;
    cancelInstall: () => void;
    removeMod: (projectId: string) => void;
    loadModVersions: (projectId: string) => Promise<void>;
    applyModVersion: (projectId: string, versionId: string) => Promise<void>;
    saveSettings: () => Promise<void>;
    saveDraft: () => Promise<void>;
    publishProfile: () => Promise<void>;
    uploadBrandingImage: (
      target: 'logo' | 'background',
      file: File | null,
    ) => Promise<void>;
    uploadFancyBundle: (file: File | null) => Promise<void>;
    rebuildFancyPreview: () => Promise<void>;
  };
};

const DEFAULT_STATUS: StatusState = {
  bootstrap: { text: 'Loading bootstrap...', tone: 'idle' },
  draft: { text: 'Ready.', tone: 'idle' },
  settings: { text: 'Ready.', tone: 'idle' },
  mods: { text: 'Ready.', tone: 'idle' },
  publish: { text: 'Ready.', tone: 'idle' },
  fancy: { text: 'Ready.', tone: 'idle' },
};

const DEFAULT_FORM: FormState = {
  searchQuery: '',
  serverName: '',
  serverAddress: '',
  profileId: '',
  currentVersion: 1,
  currentReleaseVersion: '1.0.0',
  minecraftVersion: '',
  loaderVersion: '',
  supportedMinecraftVersions: '',
  brandingLogoUrl: '',
  brandingBackgroundUrl: '',
  brandingNewsUrl: '',
  fancyMenuEnabled: 'true',
  fancyMenuMode: 'simple',
  playButtonLabel: 'Play',
  hideSingleplayer: 'true',
  hideMultiplayer: 'true',
  hideRealms: 'true',
  fancyMenuCustomLayoutUrl: '',
  fancyMenuCustomLayoutSha256: '',
};

const DEFAULT_POLICY: CoreModPolicy = {
  fabricApiProjectId: 'P7dR8mSH',
  fancyMenuProjectId: 'Wq5SjeWM',
  lockedProjectIds: ['P7dR8mSH'],
  nonRemovableProjectIds: ['P7dR8mSH'],
  rules: {
    fabricApiRequired: true,
    fabricApiVersionEditable: true,
    fancyMenuRequiredWhenEnabled: true,
    fancyMenuEnabled: false,
  },
};

const BOOTSTRAP_CACHE_TTL_MS = 15_000;
const FABRIC_VERSIONS_CACHE_TTL_MS = 60_000;
const PREVIEW_CACHE_TTL_MS = 15_000;
let bootstrapCache: { payload: BootstrapPayload; expiresAt: number } | null =
  null;
let bootstrapInFlight: Promise<BootstrapPayload> | null = null;
const fabricVersionsCache = new Map<
  string,
  { payload: FabricVersionsPayload; expiresAt: number }
>();
const fabricVersionsInFlight = new Map<string, Promise<FabricVersionsPayload>>();
const previewCache = new Map<
  string,
  { payload: FancyMenuPreviewPayload; expiresAt: number }
>();
const previewInFlight = new Map<string, Promise<FancyMenuPreviewPayload>>();

async function readBootstrapPayload(force = false): Promise<BootstrapPayload> {
  const now = Date.now();
  if (!force && bootstrapCache && bootstrapCache.expiresAt > now) {
    return bootstrapCache.payload;
  }
  if (bootstrapInFlight) {
    return bootstrapInFlight;
  }

  bootstrapInFlight = requestJson<BootstrapPayload>(
    '/v1/admin/bootstrap',
    'GET',
  )
    .then((payload) => {
      bootstrapCache = {
        payload,
        expiresAt: Date.now() + BOOTSTRAP_CACHE_TTL_MS,
      };
      return payload;
    })
    .finally(() => {
      bootstrapInFlight = null;
    });

  return bootstrapInFlight;
}

async function readFabricVersionsPayload(
  minecraftVersion: string,
  force = false,
): Promise<FabricVersionsPayload> {
  const now = Date.now();
  const cached = fabricVersionsCache.get(minecraftVersion);
  if (!force && cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const inFlight = fabricVersionsInFlight.get(minecraftVersion);
  if (inFlight) {
    return inFlight;
  }

  const request = requestJson<FabricVersionsPayload>(
    `/v1/admin/fabric/versions?minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
    'GET',
  )
    .then((payload) => {
      fabricVersionsCache.set(minecraftVersion, {
        payload,
        expiresAt: Date.now() + FABRIC_VERSIONS_CACHE_TTL_MS,
      });
      return payload;
    })
    .finally(() => {
      fabricVersionsInFlight.delete(minecraftVersion);
    });

  fabricVersionsInFlight.set(minecraftVersion, request);
  return request;
}

async function readPreviewPayload(
  fingerprint: string,
  body: {
    serverName?: string;
    fancyMenu: FancyMenuPayload;
    branding: BrandingPayload;
  },
  force = false,
): Promise<FancyMenuPreviewPayload> {
  const now = Date.now();
  const cached = previewCache.get(fingerprint);
  if (!force && cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const inFlight = previewInFlight.get(fingerprint);
  if (inFlight) {
    return inFlight;
  }

  const request = requestJson<FancyMenuPreviewPayload>(
    '/v1/admin/fancymenu/preview/build',
    'POST',
    body,
  )
    .then((payload) => {
      previewCache.set(fingerprint, {
        payload,
        expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
      });
      return payload;
    })
    .finally(() => {
      previewInFlight.delete(fingerprint);
    });

  previewInFlight.set(fingerprint, request);
  return request;
}

const AdminContext = createContext<AdminContextValue | null>(null);

function normalizeSemver(value: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return { major: 1, minor: 0, patch: 0 };
  }

  return {
    major: Number(match[1]) || 1,
    minor: Number(match[2]) || 0,
    patch: Number(match[3]) || 0,
  };
}

function bumpSemver(
  current: { major: number; minor: number; patch: number },
  type: 'major' | 'minor' | 'patch',
): string {
  if (type === 'major') {
    return `${current.major + 1}.0.0`;
  }

  if (type === 'minor') {
    return `${current.major}.${current.minor + 1}.0`;
  }

  return `${current.major}.${current.minor}.${current.patch + 1}`;
}

function modFingerprint(mod: AdminMod): string {
  return [
    mod.projectId ?? '',
    mod.versionId ?? '',
    mod.sha256 ?? '',
    mod.url ?? '',
  ].join('|');
}

function sameMods(left: AdminMod[], right: AdminMod[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const normalizedLeft = left.map(modFingerprint).slice().sort();
  const normalizedRight = right.map(modFingerprint).slice().sort();

  return normalizedLeft.every(
    (value: string, index: number) => value === normalizedRight[index],
  );
}

function mergeMods(current: AdminMod[], incoming: AdminMod[]): AdminMod[] {
  const map = new Map<string, AdminMod>();
  for (const mod of current) {
    const key = mod.projectId?.trim() || mod.name;
    map.set(key, mod);
  }
  for (const mod of incoming) {
    const key = mod.projectId?.trim() || mod.name;
    map.set(key, mod);
  }
  return Array.from(map.values());
}

function mapBootstrapToForm(payload: BootstrapPayload): FormState {
  const draft = payload.draft;
  const draftFancy = draft?.fancyMenu ?? null;
  const latestFancy = payload.latestProfile.fancyMenu ?? null;
  const fancy = draftFancy ?? latestFancy ?? null;
  const draftBranding = draft?.branding ?? null;
  const latestBranding = payload.latestProfile.branding ?? null;
  const branding = draftBranding ?? latestBranding ?? null;

  return {
    searchQuery: '',
    serverName: draft?.serverName ?? payload.server.name ?? '',
    serverAddress: draft?.serverAddress ?? payload.server.address ?? '',
    profileId: draft?.profileId ?? payload.server.profileId ?? '',
    currentVersion: payload.latestProfile.version ?? 1,
    currentReleaseVersion:
      payload.latestProfile.releaseVersion ??
      payload.appSettings.releaseVersion ??
      '1.0.0',
    minecraftVersion: payload.latestProfile.minecraftVersion ?? '',
    loaderVersion: payload.latestProfile.loaderVersion ?? '',
    supportedMinecraftVersions: (
      payload.appSettings.supportedMinecraftVersions ?? []
    ).join(', '),
    brandingLogoUrl: branding?.logoUrl ?? '',
    brandingBackgroundUrl: branding?.backgroundUrl ?? '',
    brandingNewsUrl: branding?.newsUrl ?? '',
    fancyMenuEnabled: fancy?.enabled === false ? 'false' : 'true',
    fancyMenuMode: fancy?.mode === 'custom' ? 'custom' : 'simple',
    playButtonLabel: fancy?.playButtonLabel?.trim() || 'Play',
    hideSingleplayer: fancy?.hideSingleplayer === false ? 'false' : 'true',
    hideMultiplayer: fancy?.hideMultiplayer === false ? 'false' : 'true',
    hideRealms: fancy?.hideRealms === false ? 'false' : 'true',
    fancyMenuCustomLayoutUrl: fancy?.customLayoutUrl ?? '',
    fancyMenuCustomLayoutSha256: fancy?.customLayoutSha256 ?? '',
  };
}

function buildPreviewFingerprint(formState: FormState): string {
  return [
    formState.serverName.trim(),
    formState.fancyMenuEnabled,
    formState.fancyMenuMode,
    formState.playButtonLabel.trim(),
    formState.hideSingleplayer,
    formState.hideMultiplayer,
    formState.hideRealms,
    formState.fancyMenuCustomLayoutUrl.trim(),
    formState.fancyMenuCustomLayoutSha256.trim(),
    formState.brandingLogoUrl.trim(),
    formState.brandingBackgroundUrl.trim(),
    formState.brandingNewsUrl.trim(),
  ].join('|');
}

function normalizeBrandingForCompare(
  payload: BrandingPayload,
): BrandingPayload {
  return {
    logoUrl: payload.logoUrl?.trim() || undefined,
    backgroundUrl: payload.backgroundUrl?.trim() || undefined,
    newsUrl: payload.newsUrl?.trim() || undefined,
  };
}

function buildPublishSnapshot(
  formState: FormState,
  mods: AdminMod[],
  collectFancyMenuPayload: (formState: FormState) => FancyMenuPayload,
  collectBrandingPayload: (formState: FormState) => BrandingPayload,
): PublishSnapshot {
  return {
    profileId: formState.profileId.trim(),
    serverName: formState.serverName.trim(),
    serverAddress: formState.serverAddress.trim(),
    minecraftVersion: formState.minecraftVersion.trim(),
    loaderVersion: formState.loaderVersion.trim(),
    fancyMenu: collectFancyMenuPayload(formState),
    branding: normalizeBrandingForCompare(collectBrandingPayload(formState)),
    mods: [...mods],
  };
}

function samePublishSnapshot(
  left: PublishSnapshot | null,
  right: PublishSnapshot,
): boolean {
  if (!left) {
    return false;
  }
  if (
    left.profileId !== right.profileId ||
    left.serverName !== right.serverName ||
    left.serverAddress !== right.serverAddress ||
    left.minecraftVersion !== right.minecraftVersion ||
    left.loaderVersion !== right.loaderVersion
  ) {
    return false;
  }
  if (
    JSON.stringify(left.fancyMenu) !== JSON.stringify(right.fancyMenu) ||
    JSON.stringify(left.branding) !== JSON.stringify(right.branding)
  ) {
    return false;
  }
  return sameMods(left.mods, right.mods);
}

export function AdminProvider({ children }: PropsWithChildren): ReactElement {
  const [view, setView] = useState<'overview' | 'mods' | 'fancy'>('overview');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [selectedMods, setSelectedMods] = useState<AdminMod[]>([]);
  const [coreModPolicy, setCoreModPolicy] =
    useState<CoreModPolicy>(DEFAULT_POLICY);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [dependencyMap, setDependencyMap] = useState<
    Record<string, DependencyAnalysis>
  >({});
  const [pendingInstall, setPendingInstall] = useState<PendingInstall | null>(
    null,
  );
  const [modVersionOptions, setModVersionOptions] = useState<
    Record<string, ModVersionsPayload['versions']>
  >({});
  const [loaderOptions, setLoaderOptions] = useState<LoaderOption[]>([]);
  const [sessionState, setSessionState] = useState<'pending' | 'active'>(
    'pending',
  );
  const [statuses, setStatuses] = useState<StatusState>(DEFAULT_STATUS);
  const [fancyPreview, setFancyPreview] = useState<
    FancyMenuPreviewPayload['model'] | null
  >(null);
  const [fancyPreviewExpiresAt, setFancyPreviewExpiresAt] = useState<
    string | null
  >(null);
  const [busyBootstrap, setBusyBootstrap] = useState(false);
  const [busySearch, setBusySearch] = useState(false);
  const [busyPublish, setBusyPublish] = useState(false);
  const [busyInstall, setBusyInstall] = useState(false);
  const [busyPreview, setBusyPreview] = useState(false);
  const hasBootstrappedRef = useRef(false);
  const latestProfileModsRef = useRef<AdminMod[]>([]);
  const latestProfileRuntimeRef = useRef({
    minecraftVersion: '',
    loaderVersion: '',
  });
  const selectedModsRef = useRef<AdminMod[]>([]);
  const lastFancyEnabledRef = useRef<'true' | 'false'>('true');
  const lastPublishedSnapshotRef = useRef<PublishSnapshot | null>(null);
  const previewInFlightRef = useRef<string | null>(null);
  const previewFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    selectedModsRef.current = selectedMods;
  }, [selectedMods]);

  const setStatus = useCallback(
    (name: keyof StatusState, text: string, tone: StatusTone = 'idle') => {
      setStatuses((current) => ({
        ...current,
        [name]: { text, tone },
      }));
    },
    [],
  );

  const setTextFieldFromEvent = useCallback(
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const target = event.currentTarget;
      const key = target.name as keyof FormState;
      setForm((current) => ({
        ...current,
        [key]: target.value,
      }));
    },
    [],
  );

  const collectFancyMenuPayload = useCallback(
    (formState: FormState): FancyMenuPayload => {
      const mode = formState.fancyMenuMode === 'custom' ? 'custom' : 'simple';
      return {
        enabled: formState.fancyMenuEnabled === 'true',
        mode,
        playButtonLabel: formState.playButtonLabel.trim() || 'Play',
        hideSingleplayer: formState.hideSingleplayer === 'true',
        hideMultiplayer: formState.hideMultiplayer === 'true',
        hideRealms: formState.hideRealms === 'true',
        customLayoutUrl:
          mode === 'custom'
            ? formState.fancyMenuCustomLayoutUrl.trim() || undefined
            : undefined,
        customLayoutSha256:
          mode === 'custom'
            ? formState.fancyMenuCustomLayoutSha256.trim() || undefined
            : undefined,
      };
    },
    [],
  );

  const collectBrandingPayload = useCallback(
    (formState: FormState): BrandingPayload => ({
      logoUrl: formState.brandingLogoUrl.trim() || undefined,
      backgroundUrl: formState.brandingBackgroundUrl.trim() || undefined,
      newsUrl: formState.brandingNewsUrl.trim() || undefined,
    }),
    [],
  );

  const loadFabricVersions = useCallback(
    async (minecraftVersionInput: string, force = false) => {
      const minecraftVersion = minecraftVersionInput.trim();
      if (!minecraftVersion) {
        setStatus('settings', 'Set Minecraft version first.', 'error');
        return;
      }

      setStatus('settings', 'Loading Fabric versions...');
      try {
        const payload = await readFabricVersionsPayload(
          minecraftVersion,
          force,
        );

        const options = payload.loaders ?? [];
        setLoaderOptions(options);
        setForm((current) => {
          const hasCurrent = options.some(
            (entry) => entry.version === current.loaderVersion,
          );
          if (hasCurrent) {
            return current;
          }

          const nextLoader =
            payload.latestStable ??
            options[0]?.version ??
            current.loaderVersion;
          return {
            ...current,
            loaderVersion: nextLoader,
          };
        });
        setStatus('settings', 'Fabric versions updated.', 'ok');
      } catch (error) {
        setStatus(
          'settings',
          (error as Error).message || 'Failed loading Fabric versions.',
          'error',
        );
      }
    },
    [setStatus],
  );

  const ensureCoreMods = useCallback(
    async (
      mods: AdminMod[],
      fancyEnabled: boolean,
      minecraftVersion: string,
    ) => {
      const cleanVersion = minecraftVersion.trim();
      if (!cleanVersion) {
        return mods;
      }

      let next = [...mods];
      if (!fancyEnabled) {
        next = next.filter(
          (mod) => mod.projectId !== coreModPolicy.fancyMenuProjectId,
        );
      }

      const resolveProject = async (projectId: string): Promise<AdminMod> =>
        requestJson<AdminMod>(
          `/v1/admin/mods/resolve?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(cleanVersion)}`,
          'GET',
        );

      const hasFabric = next.some(
        (mod) => mod.projectId === coreModPolicy.fabricApiProjectId,
      );
      if (!hasFabric) {
        try {
          const fabric = await resolveProject(coreModPolicy.fabricApiProjectId);
          next = mergeMods(next, [fabric]);
        } catch {
          setStatus('mods', 'Could not auto-sync Fabric API.', 'error');
        }
      }

      if (fancyEnabled) {
        const hasFancy = next.some(
          (mod) => mod.projectId === coreModPolicy.fancyMenuProjectId,
        );
        if (!hasFancy) {
          try {
            const fancy = await resolveProject(
              coreModPolicy.fancyMenuProjectId,
            );
            next = mergeMods(next, [fancy]);
          } catch {
            setStatus('mods', 'Could not auto-sync FancyMenu mod.', 'error');
          }
        }
      }

      return next;
    },
    [
      coreModPolicy.fabricApiProjectId,
      coreModPolicy.fancyMenuProjectId,
      setStatus,
    ],
  );

  const rebuildFancyPreview = useCallback(
    async (force = false) => {
      const currentForm = form;
      const fingerprint = buildPreviewFingerprint(currentForm);
      if (previewInFlightRef.current === fingerprint) {
        return;
      }
      if (!force && previewFingerprintRef.current === fingerprint) {
        return;
      }

      previewInFlightRef.current = fingerprint;
      setBusyPreview(true);
      setStatus('fancy', 'Rendering menu preview...');
      try {
        const payload = await readPreviewPayload(
          fingerprint,
          {
            serverName: currentForm.serverName.trim() || undefined,
            fancyMenu: collectFancyMenuPayload(currentForm),
            branding: collectBrandingPayload(currentForm),
          },
          force,
        );
        previewFingerprintRef.current = fingerprint;
        setFancyPreview(payload.model ?? null);
        setFancyPreviewExpiresAt(payload.expiresAt ?? null);
        setStatus('fancy', 'Preview updated.', 'ok');
      } catch (error) {
        setStatus(
          'fancy',
          (error as Error).message || 'Failed to build menu preview.',
          'error',
        );
      } finally {
        if (previewInFlightRef.current === fingerprint) {
          previewInFlightRef.current = null;
        }
        setBusyPreview(false);
      }
    },
    [collectBrandingPayload, collectFancyMenuPayload, form, setStatus],
  );

  const loadBootstrap = useCallback(async () => {
    setBusyBootstrap(true);
    setStatus('bootstrap', 'Loading bootstrap...');

    try {
      const payload = await readBootstrapPayload();
      const nextForm = mapBootstrapToForm(payload);
      setForm(nextForm);
      setCoreModPolicy(payload.latestProfile.coreModPolicy ?? DEFAULT_POLICY);
      setSelectedMods(payload.latestProfile.mods ?? []);
      latestProfileModsRef.current = payload.latestProfile.mods ?? [];
      latestProfileRuntimeRef.current = {
        minecraftVersion: payload.latestProfile.minecraftVersion ?? '',
        loaderVersion: payload.latestProfile.loaderVersion ?? '',
      };
      lastFancyEnabledRef.current = nextForm.fancyMenuEnabled;
      setSessionState('active');
      setStatus('bootstrap', 'Bootstrap loaded.', 'ok');
      await loadFabricVersions(nextForm.minecraftVersion);
      const syncedMods = await ensureCoreMods(
        payload.latestProfile.mods ?? [],
        nextForm.fancyMenuEnabled === 'true',
        nextForm.minecraftVersion,
      );
      setSelectedMods(syncedMods);
      lastPublishedSnapshotRef.current = buildPublishSnapshot(
        nextForm,
        syncedMods,
        collectFancyMenuPayload,
        collectBrandingPayload,
      );
      try {
        const previewFingerprint = buildPreviewFingerprint(nextForm);
        const previewPayload = await readPreviewPayload(previewFingerprint, {
          serverName: nextForm.serverName.trim() || undefined,
          fancyMenu: collectFancyMenuPayload(nextForm),
          branding: collectBrandingPayload(nextForm),
        });
        previewFingerprintRef.current = previewFingerprint;
        setFancyPreview(previewPayload.model ?? null);
        setFancyPreviewExpiresAt(previewPayload.expiresAt ?? null);
      } catch {
        previewFingerprintRef.current = null;
        setFancyPreview(null);
        setFancyPreviewExpiresAt(null);
      }
    } catch (error) {
      setStatus(
        'bootstrap',
        (error as Error).message || 'Bootstrap failed.',
        'error',
      );
    } finally {
      setBusyBootstrap(false);
    }
  }, [
    collectBrandingPayload,
    collectFancyMenuPayload,
    ensureCoreMods,
    loadFabricVersions,
    setStatus,
  ]);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (sessionState !== 'active') {
      return;
    }
    if (lastFancyEnabledRef.current === form.fancyMenuEnabled) {
      return;
    }
    lastFancyEnabledRef.current = form.fancyMenuEnabled;
    void (async () => {
      const synced = await ensureCoreMods(
        selectedModsRef.current,
        form.fancyMenuEnabled === 'true',
        form.minecraftVersion,
      );
      setSelectedMods(synced);
      await rebuildFancyPreview();
    })();
  }, [
    ensureCoreMods,
    form.fancyMenuEnabled,
    form.minecraftVersion,
    rebuildFancyPreview,
    sessionState,
  ]);

  const searchMods = useCallback(async () => {
    const query = form.searchQuery?.trim?.() ?? '';
    const minecraftVersion = form.minecraftVersion.trim();

    if (!query) {
      setStatus('mods', 'Type a mod name first.', 'error');
      return;
    }

    if (!minecraftVersion) {
      setStatus('mods', 'Set Minecraft version first.', 'error');
      return;
    }

    setBusySearch(true);
    setStatus('mods', 'Searching mods...');

    try {
      const results = await requestJson<SearchResult[]>(
        `/v1/admin/mods/search?query=${encodeURIComponent(query)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
        'GET',
      );
      const normalizedResults = Array.isArray(results) ? results : [];
      setSearchResults(normalizedResults);

      const dependencyEntries = await Promise.all(
        normalizedResults.map(async (entry) => {
          try {
            const analysis = await requestJson<DependencyAnalysis>(
              `/v1/admin/mods/analyze?projectId=${encodeURIComponent(entry.projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
              'GET',
            );
            return [entry.projectId, analysis] as const;
          } catch {
            return null;
          }
        }),
      );

      const dependencyRecord: Record<string, DependencyAnalysis> = {};
      for (const result of dependencyEntries) {
        if (result) {
          dependencyRecord[result[0]] = result[1];
        }
      }

      setDependencyMap(dependencyRecord);
      setStatus('mods', 'Search complete.', 'ok');
    } catch (error) {
      setStatus('mods', (error as Error).message || 'Search failed.', 'error');
    } finally {
      setBusySearch(false);
    }
  }, [form.minecraftVersion, form.searchQuery, setStatus]);

  const requestInstall = useCallback(
    async (projectId: string) => {
      const fromCache = dependencyMap[projectId];
      if (fromCache) {
        setPendingInstall({
          projectId,
          title:
            searchResults.find((entry) => entry.projectId === projectId)
              ?.title || projectId,
          dependencies: fromCache.dependencyDetails,
        });
        return;
      }

      if (!form.minecraftVersion.trim()) {
        setStatus('mods', 'Set Minecraft version first.', 'error');
        return;
      }

      try {
        const analysis = await requestJson<DependencyAnalysis>(
          `/v1/admin/mods/analyze?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(form.minecraftVersion.trim())}`,
          'GET',
        );
        setDependencyMap((current) => ({
          ...current,
          [projectId]: analysis,
        }));
        setPendingInstall({
          projectId,
          title:
            searchResults.find((entry) => entry.projectId === projectId)
              ?.title || projectId,
          dependencies: analysis.dependencyDetails,
        });
      } catch (error) {
        setStatus(
          'mods',
          (error as Error).message || 'Could not load dependency details.',
          'error',
        );
      }
    },
    [dependencyMap, form.minecraftVersion, searchResults, setStatus],
  );

  const cancelInstall = useCallback(() => {
    setPendingInstall(null);
  }, []);

  const confirmInstall = useCallback(async () => {
    if (!pendingInstall) {
      return;
    }
    const minecraftVersion = form.minecraftVersion.trim();
    if (!minecraftVersion) {
      setStatus('mods', 'Set Minecraft version first.', 'error');
      return;
    }

    setBusyInstall(true);
    setStatus('mods', 'Installing mod and dependencies...');
    try {
      const payload = await requestJson<InstallModsPayload>(
        '/v1/admin/mods/install',
        'POST',
        {
          projectId: pendingInstall.projectId,
          minecraftVersion,
          includeDependencies: true,
        },
      );
      const incoming = payload.mods ?? [];
      const merged = mergeMods(selectedModsRef.current, incoming);
      const synced = await ensureCoreMods(
        merged,
        form.fancyMenuEnabled === 'true',
        minecraftVersion,
      );
      setSelectedMods(synced);
      setPendingInstall(null);
      setStatus(
        'mods',
        `Installed ${payload.primary?.name || pendingInstall.projectId} with ${String(payload.dependencies?.length ?? 0)} dependencies.`,
        'ok',
      );
    } catch (error) {
      setStatus('mods', (error as Error).message || 'Install failed.', 'error');
    } finally {
      setBusyInstall(false);
    }
  }, [
    ensureCoreMods,
    form.fancyMenuEnabled,
    form.minecraftVersion,
    pendingInstall,
    setStatus,
  ]);

  const removeMod = useCallback(
    (projectId: string) => {
      const nonRemovable = new Set(coreModPolicy.nonRemovableProjectIds);
      if (form.fancyMenuEnabled === 'true') {
        nonRemovable.add(coreModPolicy.fancyMenuProjectId);
      }
      if (nonRemovable.has(projectId)) {
        setStatus('mods', 'This core mod cannot be removed.', 'error');
        return;
      }
      setSelectedMods((current) =>
        current.filter((entry) => entry.projectId !== projectId),
      );
      setStatus('mods', 'Mod removed.', 'ok');
    },
    [coreModPolicy, form.fancyMenuEnabled, setStatus],
  );

  const loadModVersions = useCallback(
    async (projectId: string) => {
      const minecraftVersion = form.minecraftVersion.trim();
      if (!minecraftVersion) {
        setStatus('mods', 'Set Minecraft version first.', 'error');
        return;
      }

      try {
        const payload = await requestJson<ModVersionsPayload>(
          `/v1/admin/mods/versions?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
          'GET',
        );
        setModVersionOptions((current) => ({
          ...current,
          [projectId]: payload.versions ?? [],
        }));
        setStatus('mods', `Loaded versions for ${payload.projectTitle}.`, 'ok');
      } catch (error) {
        setStatus(
          'mods',
          (error as Error).message || 'Failed to load mod versions.',
          'error',
        );
      }
    },
    [form.minecraftVersion, setStatus],
  );

  const applyModVersion = useCallback(
    async (projectId: string, versionId: string) => {
      const minecraftVersion = form.minecraftVersion.trim();
      if (!minecraftVersion) {
        setStatus('mods', 'Set Minecraft version first.', 'error');
        return;
      }
      if (!versionId.trim()) {
        return;
      }

      try {
        const resolved = await requestJson<AdminMod>(
          `/v1/admin/mods/resolve?projectId=${encodeURIComponent(projectId)}&minecraftVersion=${encodeURIComponent(minecraftVersion)}&versionId=${encodeURIComponent(versionId)}`,
          'GET',
        );
        setSelectedMods((current) =>
          current.map((entry) =>
            entry.projectId === projectId ? resolved : entry,
          ),
        );
        setStatus(
          'mods',
          `Updated ${resolved.name} to selected version.`,
          'ok',
        );
      } catch (error) {
        setStatus(
          'mods',
          (error as Error).message || 'Failed to apply mod version.',
          'error',
        );
      }
    },
    [form.minecraftVersion, setStatus],
  );

  const saveSettings = useCallback(async () => {
    const versions = form.supportedMinecraftVersions
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      const payload = await requestJson<SaveSettingsPayload>(
        '/v1/admin/settings',
        'PATCH',
        {
          supportedMinecraftVersions: versions,
          supportedPlatforms: ['fabric'],
        },
      );
      setForm((current) => ({
        ...current,
        supportedMinecraftVersions: (
          payload.supportedMinecraftVersions ?? []
        ).join(', '),
      }));
      setStatus('settings', 'Settings saved.', 'ok');
    } catch (error) {
      setStatus(
        'settings',
        (error as Error).message || 'Failed to save settings.',
        'error',
      );
    }
  }, [form.supportedMinecraftVersions, setStatus]);

  const saveDraft = useCallback(async () => {
    setStatus('draft', 'Saving draft...');
    try {
      const payload = await requestJson<SaveDraftPayload>(
        '/v1/admin/draft',
        'PATCH',
        {
          profileId: form.profileId.trim() || undefined,
          serverName: form.serverName.trim(),
          serverAddress: form.serverAddress.trim(),
          fancyMenu: collectFancyMenuPayload(form),
          branding: collectBrandingPayload(form),
        },
      );

      setForm((current) => ({
        ...current,
        serverName: payload.server?.name ?? current.serverName,
        serverAddress: payload.server?.address ?? current.serverAddress,
        profileId: payload.server?.profileId ?? current.profileId,
        currentReleaseVersion:
          payload.releaseVersion ?? current.currentReleaseVersion,
      }));
      setStatus('draft', 'Draft saved.', 'ok');
      await rebuildFancyPreview();
    } catch (error) {
      setStatus(
        'draft',
        (error as Error).message || 'Failed to save draft.',
        'error',
      );
    }
  }, [
    collectBrandingPayload,
    collectFancyMenuPayload,
    form,
    rebuildFancyPreview,
    setStatus,
  ]);

  const publishProfile = useCallback(async () => {
    const minecraftVersion = form.minecraftVersion.trim();
    const loaderVersion = form.loaderVersion.trim();
    if (!minecraftVersion || !loaderVersion) {
      setStatus(
        'publish',
        'Select Minecraft and Fabric versions first.',
        'error',
      );
      return;
    }
    if (!selectedMods.length) {
      setStatus(
        'publish',
        'Install at least one mod before publishing.',
        'error',
      );
      return;
    }

    setBusyPublish(true);
    setStatus('publish', 'Publishing next release...');

    try {
      const synced = await ensureCoreMods(
        selectedModsRef.current,
        form.fancyMenuEnabled === 'true',
        minecraftVersion,
      );
      setSelectedMods(synced);

      const published = await requestJson<PublishPayload>(
        '/v1/admin/profile/publish',
        'POST',
        {
          profileId: form.profileId.trim(),
          serverName: form.serverName.trim(),
          serverAddress: form.serverAddress.trim(),
          minecraftVersion,
          loaderVersion,
          mods: synced,
          fancyMenu: collectFancyMenuPayload(form),
          branding: collectBrandingPayload(form),
        },
      );
      setForm((current) => ({
        ...current,
        currentVersion: published.version,
        currentReleaseVersion:
          published.releaseVersion || current.currentReleaseVersion,
      }));
      latestProfileModsRef.current = [...synced];
      latestProfileRuntimeRef.current = { minecraftVersion, loaderVersion };
      lastPublishedSnapshotRef.current = buildPublishSnapshot(
        form,
        synced,
        collectFancyMenuPayload,
        collectBrandingPayload,
      );

      setStatus(
        'publish',
        `Published ${published.releaseVersion || `v${published.version}`} (${published.bumpType || 'patch'}, +${published.summary.add} / ~${published.summary.update} / -${published.summary.remove}).`,
        'ok',
      );
    } catch (error) {
      setStatus(
        'publish',
        (error as Error).message || 'Publish failed.',
        'error',
      );
    } finally {
      setBusyPublish(false);
    }
  }, [
    collectBrandingPayload,
    collectFancyMenuPayload,
    ensureCoreMods,
    form,
    selectedMods.length,
    setStatus,
  ]);

  const uploadBrandingImage = useCallback(
    async (target: 'logo' | 'background', file: File | null) => {
      if (!file) {
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      setStatus('draft', 'Uploading image...');
      try {
        const payload = await uploadForm<UploadImagePayload>(
          '/v1/admin/media/upload',
          formData,
        );
        const url = payload.url ?? '';
        setForm((current) => ({
          ...current,
          brandingLogoUrl: target === 'logo' ? url : current.brandingLogoUrl,
          brandingBackgroundUrl:
            target === 'background' ? url : current.brandingBackgroundUrl,
        }));
        setStatus('draft', 'Image uploaded.', 'ok');
        await rebuildFancyPreview();
      } catch (error) {
        setStatus(
          'draft',
          (error as Error).message || 'Upload failed.',
          'error',
        );
      }
    },
    [rebuildFancyPreview, setStatus],
  );

  const uploadFancyBundle = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      setStatus('fancy', 'Uploading FancyMenu bundle...');

      try {
        const payload = await uploadForm<UploadBundlePayload>(
          '/v1/admin/fancymenu/bundle/upload',
          formData,
        );
        setForm((current) => ({
          ...current,
          fancyMenuMode: 'custom',
          fancyMenuCustomLayoutUrl: payload.url ?? '',
          fancyMenuCustomLayoutSha256: payload.sha256 ?? '',
        }));
        setStatus(
          'fancy',
          `FancyMenu bundle uploaded (${String(payload.entryCount ?? 0)} entries).`,
          'ok',
        );
        await rebuildFancyPreview();
      } catch (error) {
        setStatus(
          'fancy',
          (error as Error).message || 'Bundle upload failed.',
          'error',
        );
      }
    },
    [rebuildFancyPreview, setStatus],
  );

  const logout = useCallback(async () => {
    try {
      await authFetch('/v1/admin/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/admin/login';
    }
  }, []);

  const rail = useMemo<RailState>(() => {
    const baselineMods = latestProfileModsRef.current;
    const baselineRuntime = latestProfileRuntimeRef.current;
    let bumpType: 'major' | 'minor' | 'patch' = 'patch';
    if (
      baselineRuntime.minecraftVersion.trim() !==
        form.minecraftVersion.trim() ||
      baselineRuntime.loaderVersion.trim() !== form.loaderVersion.trim()
    ) {
      bumpType = 'major';
    } else if (!sameMods(selectedMods, baselineMods)) {
      bumpType = 'minor';
    }
    const currentRelease = normalizeSemver(form.currentReleaseVersion);
    const nextRelease = bumpSemver(currentRelease, bumpType);
    return {
      minecraft: `MC: ${form.minecraftVersion.trim() || '-'}`,
      fabric: `Fabric: ${form.loaderVersion.trim() || '-'}`,
      nextRelease: `Next release: ${nextRelease} (${bumpType})`,
    };
  }, [
    form.currentReleaseVersion,
    form.loaderVersion,
    form.minecraftVersion,
    selectedMods,
  ]);

  const effectiveCorePolicy = useMemo<CoreModPolicy>(() => {
    const nonRemovable = new Set(coreModPolicy.nonRemovableProjectIds);
    const locked = new Set(coreModPolicy.lockedProjectIds);
    if (form.fancyMenuEnabled === 'true') {
      nonRemovable.add(coreModPolicy.fancyMenuProjectId);
      locked.add(coreModPolicy.fancyMenuProjectId);
    } else {
      nonRemovable.delete(coreModPolicy.fancyMenuProjectId);
      locked.delete(coreModPolicy.fancyMenuProjectId);
    }

    return {
      ...coreModPolicy,
      lockedProjectIds: Array.from(locked),
      nonRemovableProjectIds: Array.from(nonRemovable),
      rules: {
        ...coreModPolicy.rules,
        fancyMenuEnabled: form.fancyMenuEnabled === 'true',
      },
    };
  }, [coreModPolicy, form.fancyMenuEnabled]);

  const hasPendingPublish = useMemo<boolean>(() => {
    if (sessionState !== 'active') {
      return false;
    }
    const current = buildPublishSnapshot(
      form,
      selectedMods,
      collectFancyMenuPayload,
      collectBrandingPayload,
    );
    return !samePublishSnapshot(lastPublishedSnapshotRef.current, current);
  }, [
    collectBrandingPayload,
    collectFancyMenuPayload,
    form,
    selectedMods,
    sessionState,
  ]);

  const value = useMemo<AdminContextValue>(
    () => ({
      view,
      setView,
      form,
      setTextFieldFromEvent,
      selectedMods,
      coreModPolicy: effectiveCorePolicy,
      searchResults,
      dependencyMap,
      pendingInstall,
      modVersionOptions,
      loaderOptions,
      statuses,
      sessionState,
      hasPendingPublish,
      rail,
      fancyPreview,
      fancyPreviewExpiresAt,
      isBusy: {
        bootstrap: busyBootstrap,
        search: busySearch,
        publish: busyPublish,
        install: busyInstall,
        preview: busyPreview,
      },
      actions: {
        logout,
        refreshLoaders: () => loadFabricVersions(form.minecraftVersion, true),
        searchMods,
        requestInstall,
        confirmInstall,
        cancelInstall,
        removeMod,
        loadModVersions,
        applyModVersion,
        saveSettings,
        saveDraft,
        publishProfile,
        uploadBrandingImage,
        uploadFancyBundle,
        rebuildFancyPreview: () => rebuildFancyPreview(true),
      },
    }),
    [
      busyBootstrap,
      busyInstall,
      busyPreview,
      busyPublish,
      busySearch,
      confirmInstall,
      coreModPolicy,
      effectiveCorePolicy,
      dependencyMap,
      fancyPreview,
      fancyPreviewExpiresAt,
      form,
      hasPendingPublish,
      loadFabricVersions,
      loadModVersions,
      loaderOptions,
      logout,
      modVersionOptions,
      pendingInstall,
      publishProfile,
      rail,
      removeMod,
      requestInstall,
      saveDraft,
      saveSettings,
      searchMods,
      selectedMods,
      sessionState,
      setTextFieldFromEvent,
      statuses,
      uploadBrandingImage,
      uploadFancyBundle,
      rebuildFancyPreview,
      view,
    ],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdminContext(): AdminContextValue {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used inside AdminProvider');
  }
  return context;
}
