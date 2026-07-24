import { ctaForLifecycleStage } from './cta';

describe('ctaForLifecycleStage (UX §6)', () => {
  it('collapses Dreaming/Researching/Comparing to explore_rooms', () => {
    expect(ctaForLifecycleStage('dreaming')).toBe('explore_rooms');
    expect(ctaForLifecycleStage('researching')).toBe('explore_rooms');
    expect(ctaForLifecycleStage('comparing')).toBe('explore_rooms');
  });

  it('maps booking to book_now', () => {
    expect(ctaForLifecycleStage('booking')).toBe('book_now');
  });

  it('maps preparing to plan_my_stay — never book_now for an already-booked guest', () => {
    expect(ctaForLifecycleStage('preparing')).toBe('plan_my_stay');
  });

  it('maps staying to request_assistance', () => {
    expect(ctaForLifecycleStage('staying')).toBe('request_assistance');
  });
});
