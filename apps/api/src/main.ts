import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { getApiMetadata } from './app-metadata';
import { PrismaExceptionFilter } from './db/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const httpAdapterHost = app.get(HttpAdapterHost);

  app.useGlobalFilters(new PrismaExceptionFilter(httpAdapterHost));
  app.setGlobalPrefix('v1');

  // Correlation ID and structured logging support
  app.use((req: express.Request, next: express.NextFunction) => {
    req.headers['x-correlation-id'] =
      req.headers['x-correlation-id'] || randomUUID();
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Swagger UI injects inline bootstrapping scripts
          styleSrc: ["'self'", "'unsafe-inline'"], // Swagger UI uses inline styles
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  const isProd = config.get<string>('NODE_ENV') === 'production';
  const corsOrigin = config.get<string>('CORS_ORIGIN');
  const configuredOrigins = (corsOrigin ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowAnyOrigin = configuredOrigins.includes('*');

  if (isProd && configuredOrigins.length === 0) {
    throw new Error('CORS_ORIGIN must be configured in production');
  }

  app.enableCors({
    origin: allowAnyOrigin
      ? true
      : configuredOrigins.length > 0
        ? configuredOrigins
        : [
            'http://localhost:1420',
            'http://localhost:3001',
            'http://localhost:5173',
            'tauri://localhost',
          ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Admin-Refresh-Token',
      'X-CSRF-Token',
      'X-Correlation-Id',
    ],
    exposedHeaders: ['X-Correlation-Id'],
    credentials: true,
  });

  // Strict Request Size limits at framework level
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  const isSwaggerEnabled = config.get<string>('ENABLE_SWAGGER') === 'true';
  if (!isProd || isSwaggerEnabled) {
    const metadata = getApiMetadata();
    const swagger = new DocumentBuilder()
      .setTitle('MineRelay API')
      .setDescription('Profile metadata and lockfile API for MineRelay')
      .setVersion(metadata.version)
      .build();

    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
