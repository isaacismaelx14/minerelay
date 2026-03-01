import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/v1/profile (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/profile')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        profileId: expect.any(String),
        version: expect.any(Number),
        lockUrl: expect.any(String),
        serverName: expect.any(String),
        serverAddress: expect.any(String),
      }),
    );
  });
});
