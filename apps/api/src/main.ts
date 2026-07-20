import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Guest widget is embedded on third-party origins; CORS is per-widget-key in
  // production (API §4). Open in dev so the local widget harness can reach it.
  app.enableCors({ origin: true });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
