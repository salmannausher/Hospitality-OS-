import 'dotenv/config';
import { generateObject, streamText } from 'ai';
import { z } from 'zod';

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// 1. Classifier: structured output on the small/fast tier, routed via the gateway string.
const ClassifierSchema = z.object({
  journeyState: z.enum(['information', 'planning', 'booking_intent', 'service_recovery']),
  domain: z.array(z.enum(['accommodation', 'booking', 'dining', 'spa', 'property', 'local_area', 'policies', 'events'])),
  persona: z.enum(['luxury_traveler', 'family_traveler', 'business_traveler', 'wedding_planner', 'event_organizer']).nullable(),
  rewrittenQuery: z.string(),
  detectedSignals: z.object({ occasion: z.string().nullable(), leadCaptureWorthy: z.boolean() }),
});

try {
  const t0 = Date.now();
  const { object } = await generateObject({
    model: 'anthropic/claude-haiku-4.5',
    schema: ClassifierSchema,
    system: 'You classify a single guest message for a luxury hotel concierge. Output only the structured classification. Do not reply to the guest.',
    prompt: 'Guest message: "The AC in my room is broken and it is freezing."',
  });
  const ms = Date.now() - t0;
  check('classifier (haiku-4.5) returns valid structured output', object.journeyState === 'service_recovery', `journeyState=${object.journeyState}, ${ms}ms`);
  console.log('   classifier object:', JSON.stringify(object));
} catch (err) {
  check('classifier call', false, String(err?.message ?? err));
}

// 2. Generation: streamed first token latency on the primary tier.
try {
  const t0 = Date.now();
  let firstTokenMs = null;
  let text = '';
  const result = streamText({
    model: 'anthropic/claude-sonnet-5',
    system: 'You are the digital concierge for a luxury hotel. Answer warmly in one sentence.',
    prompt: 'What time is breakfast?',
  });
  for await (const delta of result.textStream) {
    if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
    text += delta;
  }
  check('generation (sonnet-5) streams text', text.length > 0, `firstToken=${firstTokenMs}ms, total=${Date.now() - t0}ms`);
  console.log('   generated:', JSON.stringify(text.slice(0, 120)));
} catch (err) {
  check('generation call', false, String(err?.message ?? err));
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
