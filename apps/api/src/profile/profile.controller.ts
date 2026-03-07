import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ProfileResponseDto } from './profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Throttle({ public_read: { limit: 120, ttl: 60000 } })
@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('/profile')
  @ApiOkResponse({ type: ProfileResponseDto })
  getDefaultProfile() {
    return this.profileService.getDefaultProfile();
  }

  @Get('/servers/:serverId/profile')
  @ApiOkResponse({ type: ProfileResponseDto })
  getProfile(@Param('serverId') serverId: string) {
    return this.profileService.getProfile(serverId);
  }
}
