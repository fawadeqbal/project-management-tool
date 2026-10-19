import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

export const GLOBAL_PREFIX = 'api/v1';

/** Shared by main.ts and the e2e test harness so tests exercise the real HTTP configuration. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableCors({ origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(','), credentials: true });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.enableShutdownHooks();
  return app;
}
