import { Module } from '@nestjs/common';
import { EscalationsService } from './escalations.service';

/** Escalation/handoff business logic (API §2.1/§2.3, ABS §7) — the guest-facing
 * `escalation` SSE trigger + `POST /v1/chat/escalation/choose` today; a future
 * admin escalations view (Sprint 4's `GET /v1/admin/escalations`) reuses the
 * same `EscalationsService`, not a second implementation. */
@Module({
  providers: [EscalationsService],
  exports: [EscalationsService],
})
export class EscalationsModule {}
