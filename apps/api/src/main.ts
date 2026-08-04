import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Guest widget is embedded on third-party origins, so this layer reflects
  // any Origin (a CORS preflight has no widget key to check yet — browsers
  // don't send custom headers on OPTIONS). The actual per-key origin
  // allowlist (findings-log.md #39) is enforced app-side in
  // ChatController.resolveHotel, once the widget key IS known: a
  // disallowed origin gets a 403 on the real request, even though the CORS
  // layer let the preflight through. Fail-open (any origin) for a key with
  // no allowlist configured, by design — see ChatController's own comment.
  app.enableCors({ origin: true });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
