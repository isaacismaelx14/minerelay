import { Module } from '@nestjs/common';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactsStorageService } from './artifacts-storage.service';

@Module({
  controllers: [ArtifactsController],
  providers: [ArtifactsStorageService],
  exports: [ArtifactsStorageService],
})
export class ArtifactsModule {}
