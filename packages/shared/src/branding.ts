export interface LauncherTheme {
  logoUrl?: string;
  backgroundUrl?: string;
  newsUrl?: string;
}

export interface BrandingCard {
  serverName: string;
  serverAddress: string;
  launcherTheme: LauncherTheme;
}
