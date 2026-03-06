import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFancyMenuPageModel } from "./use-fancy-menu-page-model";

const { uploadFormMock, useAdminStoreMock } = vi.hoisted(() => ({
  uploadFormMock: vi.fn(),
  useAdminStoreMock: vi.fn(),
}));

vi.mock("@/admin/client/http", () => ({
  uploadForm: uploadFormMock,
}));

vi.mock("@/admin/shared/store/admin-store", () => ({
  useAdminStore: useAdminStoreMock,
}));

describe("useFancyMenuPageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminStoreMock.mockReturnValue({
      setForm: vi.fn(),
      setStatus: vi.fn(),
    });
  });

  it("moves bundle upload logic into the fancy-menu page model", async () => {
    uploadFormMock.mockResolvedValue({
      url: "https://cdn.example.com/fancy.zip",
      sha256: "bundle-sha",
      entryCount: 12,
    });

    const { result } = renderHook(() => useFancyMenuPageModel());

    await act(async () => {
      await result.current.uploadFancyBundle(
        new File(["bundle"], "fancy.zip", { type: "application/zip" }),
      );
    });

    const store = useAdminStoreMock.mock.results[0]?.value as {
      setForm: ReturnType<typeof vi.fn>;
      setStatus: ReturnType<typeof vi.fn>;
    };
    const updater = store.setForm.mock.calls[0]?.[0] as (current: {
      fancyMenuMode: "simple" | "custom";
      fancyMenuCustomLayoutUrl: string;
      fancyMenuCustomLayoutSha256: string;
    }) => {
      fancyMenuMode: "simple" | "custom";
      fancyMenuCustomLayoutUrl: string;
      fancyMenuCustomLayoutSha256: string;
    };

    expect(
      updater({
        fancyMenuMode: "simple",
        fancyMenuCustomLayoutUrl: "",
        fancyMenuCustomLayoutSha256: "",
      }),
    ).toEqual({
      fancyMenuMode: "custom",
      fancyMenuCustomLayoutUrl: "https://cdn.example.com/fancy.zip",
      fancyMenuCustomLayoutSha256: "bundle-sha",
    });
    expect(store.setStatus).toHaveBeenLastCalledWith(
      "fancy",
      "FancyMenu bundle uploaded (12 entries).",
      "ok",
    );
  });
});
