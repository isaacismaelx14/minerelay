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

describe("useModManagerPageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminStoreMock.mockReturnValue({
      form: {
        searchQuery: "",
        minecraftVersion: "1.20.1",
        fancyMenuEnabled: "false",
      },
      dependencyMap: {},
      searchResults: [],
      selectedMods: [
        createMod({ projectId: "existing-mod", name: "Existing Mod" }),
      ],
      coreModPolicy: {
        fabricApiProjectId: "fabric-api",
        fancyMenuProjectId: "fancy-menu",
        lockedProjectIds: ["fabric-api"],
        nonRemovableProjectIds: ["fabric-api"],
        rules: {
          fabricApiRequired: true,
          fabricApiVersionEditable: true,
          fancyMenuRequiredWhenEnabled: true,
          fancyMenuEnabled: false,
        },
      },
      setStatus: vi.fn(),
      setBusy: vi.fn(),
      setSearchResults: vi.fn(),
      setDependencyMap: vi.fn(),
      setPendingInstall: vi.fn(),
      setSelectedMods: vi.fn(),
      ensureCoreMods: vi.fn(async (mods: AdminMod[]) => mods),
    });
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
});
