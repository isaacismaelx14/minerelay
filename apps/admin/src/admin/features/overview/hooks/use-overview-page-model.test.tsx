import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOverviewPageModel } from "./use-overview-page-model";

const { useAdminStoreMock } = vi.hoisted(() => ({
  useAdminStoreMock: vi.fn(),
}));

vi.mock("@/admin/shared/store/admin-store", () => ({
  useAdminStore: useAdminStoreMock,
}));

describe("useOverviewPageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminStoreMock.mockReturnValue({
      form: { serverName: "MC Server" },
      selectedMods: [{ name: "Alpha" }],
      summaryStats: { add: 1, remove: 0, update: 2, keep: 3 },
      rail: { minecraft: "MC: 1.20.1", fabric: "Fabric: 0.16.0" },
      setView: vi.fn(),
    });
  });

  it("exposes route-owned navigation callbacks", () => {
    const { result } = renderHook(() => useOverviewPageModel());

    result.current.goToIdentity();
    result.current.goToMods();
    result.current.goToFancy();

    const { setView } = useAdminStoreMock.mock.results[0]?.value as {
      setView: ReturnType<typeof vi.fn>;
    };
    expect(setView).toHaveBeenNthCalledWith(1, "identity");
    expect(setView).toHaveBeenNthCalledWith(2, "mods");
    expect(setView).toHaveBeenNthCalledWith(3, "fancy");
  });
});
