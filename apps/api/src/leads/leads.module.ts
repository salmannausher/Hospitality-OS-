import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';

/** Lead capture business logic (API §2.2, §3.4) — the guest-facing
 * `POST /v1/chat/lead` submission today; the admin inbox CRUD (Sprint 4)
 * reuses the same `LeadsService`, not a second implementation. */
@Module({
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
