import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty()
  profileId!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  minecraftVersion!: string;

  @ApiProperty({ enum: ['fabric', 'forge'] })
  loader!: 'fabric' | 'forge';

  @ApiProperty()
  loaderVersion!: string;

  @ApiProperty()
  lockUrl!: string;

  @ApiProperty()
  serverName!: string;

  @ApiProperty()
  serverAddress!: string;

  @ApiProperty({ type: [String] })
  allowedMinecraftVersions!: string[];

  @ApiProperty()
  fancyMenuEnabled!: boolean;

  @ApiProperty({ required: false, type: Object })
  fancyMenu?: Record<string, unknown>;

  @ApiProperty({ required: false })
  signature?: string;
}
