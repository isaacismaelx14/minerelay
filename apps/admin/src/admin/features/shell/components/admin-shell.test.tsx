import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminShell } from "./admin-shell";

const { useAdminStoreMock } = vi.hoisted(() => ({
  useAdminStoreMock: vi.fn(),
}));

vi.mock("@/admin/shared/store/admin-store", () => ({
  useAdminStore: useAdminStoreMock,
}));

vi.mock("./sidebar", () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}));

vi.mock("./top-bar", () => ({
  TopBar: () => <header>TopBar</header>,
}));

describe("AdminShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders route content once bootstrap is complete", () => {
    useAdminStoreMock.mockReturnValue({
      view: "overview",
      isBusy: { bootstrap: false },
    });

    render(
      <AdminShell>
        <div>Overview route</div>
      </AdminShell>,
    );

    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("TopBar")).toBeInTheDocument();
    expect(screen.getByText("Overview route")).toBeInTheDocument();
  });

  it("shows the loading shell while bootstrap is pending", () => {
    useAdminStoreMock.mockReturnValue({
      view: "overview",
      isBusy: { bootstrap: true },
    });

    render(
      <AdminShell>
        <div>Overview route</div>
      </AdminShell>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Overview route")).not.toBeInTheDocument();
  });
});
