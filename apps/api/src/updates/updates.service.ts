import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { UpdatesResponse, UpdatesResponseSchema } from '@minerelay/shared';

@Injectable()
export class UpdatesService {
  constructor(private readonly prisma: PrismaService) {}

  async getUpdates(
    serverId: string,
    clientVersion?: number,
  ): Promise<UpdatesResponse> {
    const latest = await this.prisma.profileVersion.findFirst({
      where: { serverId },
      orderBy: { version: 'desc' },
    });

    if (!latest) {
      throw new NotFoundException(
        `No profile version found for server '${serverId}'`,
      );
    }

    const hasUpdates = clientVersion == null || clientVersion < latest.version;

    return UpdatesResponseSchema.parse({
      hasUpdates,
      from: clientVersion ?? null,
      to: latest.version,
      summary: {
        add: latest.summaryAdd,
        remove: latest.summaryRemove,
        update: latest.summaryUpdate,
        keep: latest.summaryKeep,
      },
    });
  }
}
