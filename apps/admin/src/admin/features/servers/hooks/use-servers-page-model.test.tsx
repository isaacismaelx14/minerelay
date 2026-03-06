import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useServersPageModel } from "./use-servers-page-model";

const { requestJsonMock, buildEventSourceUrlMock, useAdminStoreMock } =
  vi.hoisted(() => ({
    requestJsonMock: vi.fn(),
    buildEventSourceUrlMock: vi.fn(),
    useAdminStoreMock: vi.fn(),
  }));

vi.mock("@/admin/client/http", () => ({
  buildEventSourceUrl: buildEventSourceUrlMock,
  requestJson: requestJsonMock,
}));

vi.mock("@/admin/shared/store/admin-store", () => ({
  useAdminStore: useAdminStoreMock,
}));

describe("useServersPageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildEventSourceUrlMock.mockReturnValue(
      "https://api.example.com/v1/admin/exaroton/server/stream",
    );
    useAdminStoreMock.mockReturnValue({
      exaroton: {
        configured: true,
        connected: false,
        accountName: "",
        accountEmail: "",
        apiKeyInput: "",
        showApiKey: false,
        servers: [],
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
        busy: false,
        error: "",
        connectionStep: "idle",
      },
      setExaroton: vi.fn(),
      setStatus: vi.fn(),
    });
  });

  it("keeps connect validation inside the servers page model", async () => {
    const { result } = renderHook(() => useServersPageModel());

    await act(async () => {
      await result.current.connectExaroton();
    });

    const store = useAdminStoreMock.mock.results[0]?.value as {
      setStatus: ReturnType<typeof vi.fn>;
    };
    expect(store.setStatus).toHaveBeenCalledWith(
      "exaroton",
      "Enter your Exaroton API key first.",
      "error",
    );
    expect(requestJsonMock).not.toHaveBeenCalled();
  });
});
