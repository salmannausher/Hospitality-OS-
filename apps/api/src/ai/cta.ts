import type { CtaKind, LifecycleStage } from '@hospitality/types';

/**
 * UX §6's CTA-by-lifecycle-stage table, made real. Deterministic, no model
 * call — a pure function, unit-tested (cta.spec.ts) the same way the rerank/
 * confidence formulas are (Engineering Conventions §9). Dreaming/Researching/
 * Comparing collapse to the same CTA today; Playbook §6 keeps them distinct
 * signals anyway since a future tone-calibration/escalation-urgency use of
 * lifecycleStage would want the finer distinction even though this mapping
 * doesn't need it yet.
 */
export function ctaForLifecycleStage(stage: LifecycleStage): CtaKind {
  switch (stage) {
    case 'dreaming':
    case 'researching':
    case 'comparing':
      return 'explore_rooms';
    case 'booking':
      return 'book_now';
    case 'preparing':
      return 'plan_my_stay';
    case 'staying':
      return 'request_assistance';
  }
}
