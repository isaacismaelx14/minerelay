import { SetMetadata } from '@nestjs/common';

export const LAUNCHER_PUBLIC_KEY = 'launcherPublic';
export const LauncherPublic = () => SetMetadata(LAUNCHER_PUBLIC_KEY, true);
