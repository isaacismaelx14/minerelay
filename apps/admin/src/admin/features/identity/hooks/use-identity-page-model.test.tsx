import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useIdentityPageModel } from "./use-identity-page-model";

const { requestJsonMock, uploadFormMock, useAdminStoreMock } = vi.hoisted(
  () => ({
    requestJsonMock: vi.fn(),
    uploadFormMock: vi.fn(),
    useAdminStoreMock: vi.fn(),
  }),
);

vi.mock("@/admin/client/http", () => ({
  requestJson: requestJsonMock,
  uploadForm: uploadFormMock,
}));

vi.mock("@/admin/shared/store/admin-store", () => ({
  useAdminStore: useAdminStoreMock,
}));

describe("useIdentityPageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminStoreMock.mockReturnValue({
      form: {
        supportedMinecraftVersions: "1.20.1, 1.20.4",
        brandingLogoUrl: "",
        brandingBackgroundUrl: "",
      },
      setForm: vi.fn(),
      setStatus: vi.fn(),
      loadFabricVersions: vi.fn(),
    });
  });

  it("saves supported Minecraft versions through the identity model", async () => {
    requestJsonMock.mockResolvedValue({
      supportedMinecraftVersions: ["1.20.1", "1.20.4"],
      supportedPlatforms: ["fabric"],
      releaseVersion: "1.2.0",
    });

    const { result } = renderHook(() => useIdentityPageModel());

    await act(async () => {
      await result.current.saveSettings();
    });

    expect(requestJsonMock).toHaveBeenCalledWith(
      "/v1/admin/settings",
      "PATCH",
      {
        supportedMinecraftVersions: ["1.20.1", "1.20.4"],
        supportedPlatforms: ["fabric"],
      },
    );

    const store = useAdminStoreMock.mock.results[0]?.value as {
      setForm: ReturnType<typeof vi.fn>;
      setStatus: ReturnType<typeof vi.fn>;
      form: { supportedMinecraftVersions: string };
    };
    const updater = store.setForm.mock.calls[0]?.[0] as (
      current: typeof store.form,
    ) => typeof store.form;
    expect(
      updater({ ...store.form, supportedMinecraftVersions: "" })
        .supportedMinecraftVersions,
    ).toBe("1.20.1, 1.20.4");
    expect(store.setStatus).toHaveBeenCalledWith(
      "settings",
      "Settings saved.",
      "ok",
    );
  });
});
