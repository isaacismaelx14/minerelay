import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getApiMetadata } from './app-metadata';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return base service metadata', () => {
      const metadata = getApiMetadata();
      expect(appController.getBaseInfo()).toEqual({
        service: 'api',
        packageName: metadata.name,
        version: metadata.version,
        status: 'ok',
      });
    });
  });
});
