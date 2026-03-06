import { describe, expect, it } from "vitest";

import { getAdminPathForView, getAdminViewForPath } from "./admin-view";

describe("admin view mapping", () => {
  it("maps views to standalone routes", () => {
    expect(getAdminPathForView("overview")).toBe("/");
    expect(getAdminPathForView("identity")).toBe("/identity");
    expect(getAdminPathForView("mods")).toBe("/mod-manager");
    expect(getAdminPathForView("fancy")).toBe("/fancy-menu");
    expect(getAdminPathForView("servers")).toBe("/servers");
    expect(getAdminPathForView("launcher")).toBe("/launcher");
  });

  it("resolves routes back to the correct admin views", () => {
    expect(getAdminViewForPath("/")).toBe("overview");
    expect(getAdminViewForPath("/identity")).toBe("identity");
    expect(getAdminViewForPath("/mod-manager")).toBe("mods");
    expect(getAdminViewForPath("/fancy-menu")).toBe("fancy");
    expect(getAdminViewForPath("/servers")).toBe("servers");
    expect(getAdminViewForPath("/launcher")).toBe("launcher");
    expect(getAdminViewForPath("/unknown")).toBe("overview");
  });
});
