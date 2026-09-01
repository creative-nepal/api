import type { Server } from 'http';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<Server>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<INestApplication<Server>>();
    await app.init();
  });

  it('/api/health (GET)', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});
