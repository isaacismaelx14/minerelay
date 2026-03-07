import { IsOptional, IsString } from 'class-validator';

export class CreateLauncherPairingClaimDto {
  @IsString()
  @IsOptional()
  apiBaseUrl?: string;
}
