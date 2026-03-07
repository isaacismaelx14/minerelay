import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BootstrapPayload } from "@/admin/client/types";

import { AdminStoreProvider, useAdminStore } from "./admin-store";

const { pushMock, readBootstrapPayloadMock, readFabricVersionsPayloadMock } =
  vi.hoisted(() => ({
    pushMock: vi.fn(),
    readBootstrapPayloadMock: vi.fn(),
    readFabricVersionsPayloadMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/admin/shared/services/bootstrap", () => ({
  readBootstrapPayload: readBootstrapPayloadMock,
  readFabricVersionsPayload: readFabricVersionsPayloadMock,
}));

function createBootstrapPayload(): BootstrapPayload {
  return {
    server: {
      id: "global",
      name: "Server",
      address: "127.0.0.1",
      profileId: "profile-a",
    },
    latestProfile: {
      version: 1,
      releaseVersion: "1.0.0",
      minecraftVersion: "1.20.1",
      loader: "fabric",
      loaderVersion: "0.16.0",
      mods: [],
      resources: [],
      shaders: [],
      coreModPolicy: {
        fabricApiProjectId: "P7dR8mSH",
        fancyMenuProjectId: "Wq5SjeWM",
        modMenuProjectId: "mOgUt4GM",
        fancyMenuDependencyProjectIds: [],
        modMenuDependencyProjectIds: [],
        lockedProjectIds: ["P7dR8mSH", "mOgUt4GM"],
        nonRemovableProjectIds: ["P7dR8mSH", "mOgUt4GM"],
        rules: {
          fabricApiRequired: true,
          fabricApiVersionEditable: true,
          fancyMenuRequiredWhenEnabled: true,
          modMenuRequired: true,
          fancyMenuEnabled: false,
        },
      },
    },
    appSettings: {
      supportedMinecraftVersions: ["1.20.1"],
      supportedPlatforms: ["fabric"],
      releaseVersion: "1.0.0",
    },
    draft: null,
    hasSavedDraft: false,
    exaroton: {
      configured: false,
      connected: false,
      account: null,
      selectedServer: null,
      settings: {
        serverStatusEnabled: true,
        modsSyncEnabled: true,
        playerCanViewStatus: true,
        playerCanViewOnlinePlayers: true,
        playerCanStartServer: false,
        playerCanStopServer: false,
        playerCanRestartServer: false,
      },
      error: null,
    },
    fabricVersions: {
      minecraftVersion: "1.20.1",
      loaders: [{ version: "0.16.0", stable: true }],
      latestStable: "0.16.0",
    },
  };
}

function Probe() {
  useAdminStore();
  return <div>probe</div>;
}

describe("AdminStoreProvider hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFabricVersionsPayloadMock.mockResolvedValue({
      minecraftVersion: "1.20.1",
      loaders: [{ version: "0.16.0", stable: true }],
      latestStable: "0.16.0",
    });
    readBootstrapPayloadMock.mockResolvedValue(createBootstrapPayload());
  });

  it("skips bootstrap fetch when initial bootstrap payload is provided", async () => {
    render(
      <AdminStoreProvider initialBootstrap={createBootstrapPayload()}>
        <Probe />
      </AdminStoreProvider>,
    );

    await waitFor(() => {
      expect(readBootstrapPayloadMock).not.toHaveBeenCalled();
    });
  });
});
