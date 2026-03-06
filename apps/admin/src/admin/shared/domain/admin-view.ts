export type AdminView =
  | "overview"
  | "identity"
  | "mods"
  | "fancy"
  | "servers"
  | "launcher";

const ADMIN_VIEW_PATHS: Record<AdminView, string> = {
  overview: "/",
  identity: "/identity",
  mods: "/mod-manager",
  fancy: "/fancy-menu",
  servers: "/servers",
  launcher: "/launcher",
};

export function getAdminPathForView(view: AdminView): string {
  return ADMIN_VIEW_PATHS[view];
}

export function getAdminViewForPath(
  pathname: string | null | undefined,
): AdminView {
  const normalized = pathname && pathname !== "" ? pathname : "/";
  if (normalized === "/identity") {
    return "identity";
  }
  if (normalized === "/mod-manager") {
    return "mods";
  }
  if (normalized === "/fancy-menu") {
    return "fancy";
  }
  if (normalized === "/servers") {
    return "servers";
  }
  if (normalized === "/launcher") {
    return "launcher";
  }
  return "overview";
}
