import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
  type PropsWithChildren,
} from 'react';
import { authFetch, requestJson, uploadForm } from './http';
import type {
  AdminMod,
  BootstrapPayload,
  BrandingPayload,
  DependencyAnalysis,
  FabricVersionsPayload,
  InstallModsPayload,
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

type RailState = {
  minecraft: string;
  fabric: string;
  nextRelease: string;
};

type AdminContextValue = {
  form: FormState;
  setField: <K extends keyof FormState>(name: K, value: FormState[K]) => void;
  setTextFieldFromEvent: (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  selectedMods: AdminMod[];
  searchResults: SearchResult[];
  dependencyMap: Record<string, DependencyAnalysis>;
  loaderOptions: LoaderOption[];
  statuses: StatusState;
  sessionState: 'pending' | 'active';
  rail: RailState;
  isBusy: {
    bootstrap: boolean;
    search: boolean;
    publish: boolean;
  };
  actions: {
    logout: () => Promise<void>;
    refreshLoaders: () => Promise<void>;
    searchMods: () => Promise<void>;
    installMod: (projectId: string) => Promise<void>;
    removeMod: (projectId: string) => void;
    saveSettings: () => Promise<void>;
    saveDraft: () => Promise<void>;
    publishProfile: () => Promise<void>;
    uploadBrandingImage: (
      target: 'logo' | 'background',
      file: File | null,
    ) => Promise<void>;
    uploadFancyBundle: (file: File | null) => Promise<void>;
  };
};

const DEFAULT_STATUS: StatusState = {
  bootstrap: { text: 'Loading bootstrap...', tone: 'idle' },
  draft: { text: 'Ready.', tone: 'idle' },
  settings: { text: 'Ready.', tone: 'idle' },
  mods: { text: 'Ready.', tone: 'idle' },
  publish: { text: 'Ready.', tone: 'idle' },
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

export function AdminProvider({ children }: PropsWithChildren): ReactElement {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [selectedMods, setSelectedMods] = useState<AdminMod[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [dependencyMap, setDependencyMap] = useState<
    Record<string, DependencyAnalysis>
  >({});
  const [loaderOptions, setLoaderOptions] = useState<LoaderOption[]>([]);
  const [sessionState, setSessionState] = useState<'pending' | 'active'>(
    'pending',
  );
  const [statuses, setStatuses] = useState<StatusState>(DEFAULT_STATUS);
  const [busyBootstrap, setBusyBootstrap] = useState(false);
  const [busySearch, setBusySearch] = useState(false);
  const [busyPublish, setBusyPublish] = useState(false);
  const latestProfileModsRef = useRef<AdminMod[]>([]);
  const latestProfileRuntimeRef = useRef({
    minecraftVersion: '',
    loaderVersion: '',
  });

  const setStatus = useCallback(
    (name: keyof StatusState, text: string, tone: StatusTone = 'idle') => {
      setStatuses((current) => ({
        ...current,
        [name]: { text, tone },
      }));
    },
    [],
  );

  const setField = useCallback(
    <K extends keyof FormState>(name: K, value: FormState[K]) => {
      setForm((current) => ({
        ...current,
        [name]: value,
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

  const loadFabricVersions = useCallback(
    async (overrideMinecraftVersion?: string) => {
      const minecraftVersion = (
        overrideMinecraftVersion ?? form.minecraftVersion
      ).trim();
      if (!minecraftVersion) {
        setStatus('settings', 'Set Minecraft version first.', 'error');
        return;
      }

      setStatus('settings', 'Loading Fabric versions...');
      try {
        const payload = await requestJson<FabricVersionsPayload>(
          `/v1/admin/fabric/versions?minecraftVersion=${encodeURIComponent(minecraftVersion)}`,
          'GET',
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
    [form.minecraftVersion, setStatus],
  );

  const loadBootstrap = useCallback(async () => {
    setBusyBootstrap(true);
    setStatus('bootstrap', 'Loading bootstrap...');

    try {
      const payload = await requestJson<BootstrapPayload>(
        '/v1/admin/bootstrap',
        'GET',
      );
      const nextForm = mapBootstrapToForm(payload);
      setForm(nextForm);
      setSelectedMods(payload.latestProfile.mods ?? []);
      latestProfileModsRef.current = payload.latestProfile.mods ?? [];
      latestProfileRuntimeRef.current = {
        minecraftVersion: payload.latestProfile.minecraftVersion ?? '',
        loaderVersion: payload.latestProfile.loaderVersion ?? '',
      };
      setSessionState('active');
      setStatus('bootstrap', 'Bootstrap loaded.', 'ok');
      await loadFabricVersions(nextForm.minecraftVersion);
    } catch (error) {
      setStatus(
        'bootstrap',
        (error as Error).message || 'Bootstrap failed.',
        'error',
      );
    } finally {
      setBusyBootstrap(false);
    }
  }, [loadFabricVersions, setStatus]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

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
  }, [form.minecraftVersion, setStatus]);

  const installMod = useCallback(
    async (projectId: string) => {
      const minecraftVersion = form.minecraftVersion.trim();
      if (!minecraftVersion) {
        setStatus('mods', 'Set Minecraft version first.', 'error');
        return;
      }

      setStatus('mods', 'Installing mod and required dependencies...');

      try {
        const payload = await requestJson<InstallModsPayload>(
          '/v1/admin/mods/install',
          'POST',
          {
            projectId,
            minecraftVersion,
            includeDependencies: true,
          },
        );

        const incoming = Array.isArray(payload.mods) ? payload.mods : [];
        setSelectedMods((current) => {
          const next = [...current];
          for (const mod of incoming) {
            const idx = next.findIndex(
              (entry) => entry.projectId === mod.projectId,
            );
            if (idx >= 0) {
              next[idx] = mod;
            } else {
              next.push(mod);
            }
          }
          return next;
        });

        setStatus('mods', `Installed ${incoming.length} mod(s).`, 'ok');
      } catch (error) {
        setStatus(
          'mods',
          (error as Error).message || 'Install failed.',
          'error',
        );
      }
    },
    [form.minecraftVersion, setStatus],
  );

  const removeMod = useCallback(
    (projectId: string) => {
      setSelectedMods((current) =>
        current.filter((entry) => entry.projectId !== projectId),
      );
      setStatus('mods', 'Mod removed.', 'ok');
    },
    [setStatus],
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

      setField(
        'supportedMinecraftVersions',
        (payload.supportedMinecraftVersions ?? []).join(', '),
      );
      setStatus('settings', 'Settings saved.', 'ok');
    } catch (error) {
      setStatus(
        'settings',
        (error as Error).message || 'Failed to save settings.',
        'error',
      );
    }
  }, [form.supportedMinecraftVersions, setField, setStatus]);

  const collectFancyMenuPayload = useCallback(() => {
    const mode = form.fancyMenuMode === 'custom' ? 'custom' : 'simple';
    return {
      enabled: form.fancyMenuEnabled === 'true',
      mode,
      playButtonLabel: form.playButtonLabel.trim() || 'Play',
      hideSingleplayer: form.hideSingleplayer === 'true',
      hideMultiplayer: form.hideMultiplayer === 'true',
      hideRealms: form.hideRealms === 'true',
      customLayoutUrl:
        mode === 'custom'
          ? form.fancyMenuCustomLayoutUrl.trim() || undefined
          : undefined,
      customLayoutSha256:
        mode === 'custom'
          ? form.fancyMenuCustomLayoutSha256.trim() || undefined
          : undefined,
    };
  }, [form]);

  const collectBrandingPayload = useCallback<() => BrandingPayload>(
    () => ({
      logoUrl: form.brandingLogoUrl.trim() || undefined,
      backgroundUrl: form.brandingBackgroundUrl.trim() || undefined,
      newsUrl: form.brandingNewsUrl.trim() || undefined,
    }),
    [form.brandingBackgroundUrl, form.brandingLogoUrl, form.brandingNewsUrl],
  );

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
          fancyMenu: collectFancyMenuPayload(),
          branding: collectBrandingPayload(),
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
    form.profileId,
    form.serverAddress,
    form.serverName,
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
      const published = await requestJson<PublishPayload>(
        '/v1/admin/profile/publish',
        'POST',
        {
          profileId: form.profileId.trim(),
          serverName: form.serverName.trim(),
          serverAddress: form.serverAddress.trim(),
          minecraftVersion,
          loaderVersion,
          mods: selectedMods,
          fancyMenu: collectFancyMenuPayload(),
          branding: collectBrandingPayload(),
        },
      );

      setForm((current) => ({
        ...current,
        currentVersion: published.version,
        currentReleaseVersion:
          published.releaseVersion || current.currentReleaseVersion,
      }));

      latestProfileModsRef.current = [...selectedMods];
      latestProfileRuntimeRef.current = { minecraftVersion, loaderVersion };

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
    form.loaderVersion,
    form.minecraftVersion,
    form.profileId,
    form.serverAddress,
    form.serverName,
    selectedMods,
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
        if (target === 'logo') {
          setField('brandingLogoUrl', url);
        } else {
          setField('brandingBackgroundUrl', url);
        }
        setStatus('draft', 'Image uploaded.', 'ok');
      } catch (error) {
        setStatus(
          'draft',
          (error as Error).message || 'Upload failed.',
          'error',
        );
      }
    },
    [setField, setStatus],
  );

  const uploadFancyBundle = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      setStatus('publish', 'Uploading FancyMenu bundle...');

      try {
        const payload = await uploadForm<UploadBundlePayload>(
          '/v1/admin/fancymenu/bundle/upload',
          formData,
        );
        setField('fancyMenuMode', 'custom');
        setField('fancyMenuCustomLayoutUrl', payload.url ?? '');
        setField('fancyMenuCustomLayoutSha256', payload.sha256 ?? '');
        setStatus(
          'publish',
          `FancyMenu bundle uploaded (${String(payload.entryCount ?? 0)} entries).`,
          'ok',
        );
      } catch (error) {
        setStatus(
          'publish',
          (error as Error).message || 'Bundle upload failed.',
          'error',
        );
      }
    },
    [setField, setStatus],
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

  const value = useMemo<AdminContextValue>(
    () => ({
      form,
      setField,
      setTextFieldFromEvent,
      selectedMods,
      searchResults,
      dependencyMap,
      loaderOptions,
      statuses,
      sessionState,
      rail,
      isBusy: {
        bootstrap: busyBootstrap,
        search: busySearch,
        publish: busyPublish,
      },
      actions: {
        logout,
        refreshLoaders: () => loadFabricVersions(),
        searchMods,
        installMod,
        removeMod,
        saveSettings,
        saveDraft,
        publishProfile,
        uploadBrandingImage,
        uploadFancyBundle,
      },
    }),
    [
      busyBootstrap,
      busyPublish,
      busySearch,
      dependencyMap,
      form,
      installMod,
      loadFabricVersions,
      loaderOptions,
      logout,
      publishProfile,
      rail,
      removeMod,
      saveDraft,
      saveSettings,
      searchMods,
      selectedMods,
      sessionState,
      setField,
      setTextFieldFromEvent,
      statuses,
      uploadBrandingImage,
      uploadFancyBundle,
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
