import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminMod } from "@/admin/client/types";

import { useModManagerPageModel } from "./use-mod-manager-page-model";

const { requestJsonMock, useAdminStoreMock } = vi.hoisted(() => ({
  requestJsonMock: vi.fn(),
  useAdminStoreMock: vi.fn(),
}));

vi.mock("@/admin/client/http", () => ({
  requestJson: requestJsonMock,
}));

vi.mock("@/admin/shared/store/admin-store", () => ({
  useAdminStore: useAdminStoreMock,
}));

function createMod(overrides: Partial<AdminMod> = {}): AdminMod {
  return {
    kind: "mod",
    name: "Example Mod",
    provider: "modrinth",
    side: "client",
    projectId: "base-mod",
    versionId: "1.0.0",
    url: "https://cdn.example.com/mod.jar",
    sha256: "sha-base",
    ...overrides,
  };
}

function createStore(overrides: Record<string, unknown> = {}) {
  const coreModPolicy = {
    fabricApiProjectId: "fabric-api",
    fancyMenuProjectId: "fancy-menu",
    modMenuProjectId: "mod-menu",
    fancyMenuDependencyProjectIds: [],
    modMenuDependencyProjectIds: [],
    lockedProjectIds: ["fabric-api", "mod-menu"],
    nonRemovableProjectIds: ["fabric-api", "mod-menu"],
    rules: {
      fabricApiRequired: true,
      fabricApiVersionEditable: true,
      fancyMenuRequiredWhenEnabled: true,
      modMenuRequired: true,
      fancyMenuEnabled: false,
    },
  };

  return {
    form: {
      searchQuery: "",
      minecraftVersion: "1.20.1",
      fancyMenuEnabled: "false",
    },
    dependencyMap: {},
    searchResults: [],
    exaroton: {
      connected: true,
    },
    selectedMods: [
      createMod({ projectId: "existing-mod", name: "Existing Mod" }),
    ],
    coreModPolicy,
    effectiveCorePolicy: coreModPolicy,
    setStatus: vi.fn(),
    setBusy: vi.fn(),
    setSearchResults: vi.fn(),
    setDependencyMap: vi.fn(),
    setPendingInstall: vi.fn(),
    setSelectedMods: vi.fn(),
    ensureCoreMods: vi.fn(async (mods: AdminMod[]) => mods),
    ...overrides,
  };
}

describe("useModManagerPageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminStoreMock.mockReturnValue(createStore());
  });

  it("merges installed results with the existing draft before syncing core mods", async () => {
    requestJsonMock.mockResolvedValue({
      primary: createMod({ projectId: "new-mod", name: "New Mod" }),
      dependencies: [],
      mods: [createMod({ projectId: "new-mod", name: "New Mod" })],
    });

    const { result } = renderHook(() => useModManagerPageModel());

    await act(async () => {
      await result.current.requestAndConfirmInstall("new-mod");
    });

    const store = useAdminStoreMock.mock.results[0]?.value as {
      ensureCoreMods: ReturnType<typeof vi.fn>;
      setSelectedMods: ReturnType<typeof vi.fn>;
      setStatus: ReturnType<typeof vi.fn>;
    };

    expect(store.ensureCoreMods).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ projectId: "existing-mod" }),
        expect.objectContaining({ projectId: "new-mod" }),
      ]),
      false,
      "1.20.1",
    );
    expect(store.setSelectedMods).toHaveBeenCalled();
    expect(store.setStatus).toHaveBeenCalledWith(
      "mods",
      "Installed New Mod with 0 dependencies.",
      "ok",
    );
  });

  it("installs all queued mods without dropping earlier installs", async () => {
    requestJsonMock.mockImplementation(
      async (_url: string, _method: string, body: { projectId: string }) => {
        if (body.projectId === "mod-a") {
          return {
            primary: createMod({ projectId: "mod-a", name: "Mod A" }),
            dependencies: [createMod({ projectId: "dep-a", name: "Dep A" })],
            mods: [
              createMod({ projectId: "mod-a", name: "Mod A" }),
              createMod({ projectId: "dep-a", name: "Dep A" }),
            ],
          };
        }

        return {
          primary: createMod({ projectId: "mod-b", name: "Mod B" }),
          dependencies: [],
          mods: [createMod({ projectId: "mod-b", name: "Mod B" })],
        };
      },
    );

    const { result } = renderHook(() => useModManagerPageModel());

    await act(async () => {
      await result.current.requestAndConfirmInstall("mod-a");
      await result.current.requestAndConfirmInstall("mod-b");
    });

    const store = useAdminStoreMock.mock.results[0]?.value as {
      ensureCoreMods: ReturnType<typeof vi.fn>;
      setSelectedMods: ReturnType<typeof vi.fn>;
    };

    expect(store.ensureCoreMods).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ projectId: "existing-mod" }),
        expect.objectContaining({ projectId: "mod-a" }),
        expect.objectContaining({ projectId: "dep-a" }),
      ]),
      false,
      "1.20.1",
    );

    expect(store.ensureCoreMods).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({ projectId: "existing-mod" }),
        expect.objectContaining({ projectId: "mod-a" }),
        expect.objectContaining({ projectId: "dep-a" }),
        expect.objectContaining({ projectId: "mod-b" }),
      ]),
      false,
      "1.20.1",
    );

    expect(store.setSelectedMods).toHaveBeenCalledTimes(2);
  });

  it("defaults new installs to server when client side is unsupported", async () => {
    requestJsonMock.mockResolvedValue({
      primary: createMod({
        projectId: "server-only",
        name: "Server Only",
        side: "client",
        clientSide: "unsupported",
        serverSide: "required",
      }),
      dependencies: [],
      mods: [
        createMod({
          projectId: "server-only",
          name: "Server Only",
          side: "client",
          clientSide: "unsupported",
          serverSide: "required",
        }),
      ],
    });

    const { result } = renderHook(() => useModManagerPageModel());

    await act(async () => {
      await result.current.requestAndConfirmInstall("server-only");
    });

    const store = useAdminStoreMock.mock.results[0]?.value as {
      ensureCoreMods: ReturnType<typeof vi.fn>;
    };

    expect(store.ensureCoreMods).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          projectId: "server-only",
          side: "server",
        }),
      ]),
      false,
      "1.20.1",
    );
  });

  it("keeps installs client-only and warns when server integration is disconnected", async () => {
    useAdminStoreMock.mockReturnValue(
      createStore({
        exaroton: {
          connected: false,
        },
      }),
    );
    requestJsonMock.mockResolvedValue({
      primary: createMod({
        projectId: "needs-server",
        name: "Needs Server",
        side: "client",
        clientSide: "optional",
        serverSide: "required",
      }),
      dependencies: [],
      mods: [
        createMod({
          projectId: "needs-server",
          name: "Needs Server",
          side: "client",
          clientSide: "optional",
          serverSide: "required",
        }),
      ],
    });

    const { result } = renderHook(() => useModManagerPageModel());

    await act(async () => {
      await result.current.requestAndConfirmInstall("needs-server");
    });

    const store = useAdminStoreMock.mock.results[0]?.value as {
      ensureCoreMods: ReturnType<typeof vi.fn>;
      setStatus: ReturnType<typeof vi.fn>;
    };

    expect(store.ensureCoreMods).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          projectId: "needs-server",
          side: "client",
        }),
      ]),
      false,
      "1.20.1",
    );
    expect(store.setStatus).toHaveBeenCalledWith(
      "mods",
      expect.stringContaining("requires server-side support"),
      "error",
    );
  });
});
