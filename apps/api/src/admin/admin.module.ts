import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionController } from './session.controller';

/** Admin API surface (API §3) — session/hotels/knowledge/etc. modules land here as they're built. */
@Module({
  imports: [AuthModule],
  controllers: [SessionController],
})
export class AdminModule {}
