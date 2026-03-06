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

  // Correlation ID and structured logging support
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      req.headers['x-correlation-id'] =
        req.headers['x-correlation-id'] || randomUUID();
      next();
    },
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Needed for some React hydration and basic UI interactions, can be tightened later
          styleSrc: ["'self'", "'unsafe-inline'"], // Allows inline styles injected by React
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

  if (isProd && configuredOrigins.length === 0) {
    throw new Error('CORS_ORIGIN must be configured in production');
  }

  app.enableCors({
    origin:
      configuredOrigins.length > 0
        ? configuredOrigins
        : [
            'http://localhost:1420',
            'http://localhost:5173',
            'tauri://localhost',
          ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
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
      .setTitle('Minecraft Server Syncer API')
      .setDescription(
        'Profile metadata and lockfile API for the Minecraft Server Syncer',
      )
      .setVersion(metadata.version)
      .build();

    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
