import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ProfileResponseDto } from './profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('/v1/profile')
  @ApiOkResponse({ type: ProfileResponseDto })
  getDefaultProfile() {
    return this.profileService.getDefaultProfile();
  }

  @Get('/v1/servers/:serverId/profile')
  @ApiOkResponse({ type: ProfileResponseDto })
  getProfile(@Param('serverId') serverId: string) {
    return this.profileService.getProfile(serverId);
  }
}
