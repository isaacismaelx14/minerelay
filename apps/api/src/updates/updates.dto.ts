import { ApiProperty } from '@nestjs/swagger';

class SummaryDto {
  @ApiProperty()
  add!: number;

  @ApiProperty()
  remove!: number;

  @ApiProperty()
  update!: number;

  @ApiProperty()
  keep!: number;
}

export class UpdatesResponseDto {
  @ApiProperty()
  hasUpdates!: boolean;

  @ApiProperty({ nullable: true })
  from!: number | null;

  @ApiProperty()
  to!: number;

  @ApiProperty({ type: SummaryDto })
  summary!: SummaryDto;
}
