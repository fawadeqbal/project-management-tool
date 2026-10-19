import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  Logger.log(`Hearth API listening on http://localhost:${port}/api/v1`, 'Bootstrap');
}

void bootstrap();
