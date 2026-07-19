import { Kicker } from "./Kicker";
import { Reveal } from "./Reveal";

export function Problem() {
  return (
    <section className="px-6 py-28 md:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Kicker index="01">The problem</Kicker>
        </Reveal>

        <div className="mt-12 grid gap-14 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <Reveal delay={0.1}>
              <h2 className="font-display text-4xl font-light leading-[1.12] tracking-[-0.01em] md:text-5xl">
                Every chatbot answers questions. That was never the job.
              </h2>
            </Reveal>
          </div>
          <div className="space-y-6 leading-relaxed text-ink-soft lg:col-span-5 lg:col-start-8">
            <Reveal delay={0.2}>
              <p>
                The concierge desk was never really about information. It is
                about judgment — knowing a routine question from a guest who is
                quietly unhappy, and a request from an occasion. Most hotel
                chatbots know neither.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <p>
                And when they cannot find an answer, they do the one thing no
                member of your staff would ever do in the lobby: they guess.
                Politely, fluently, and wrong.
              </p>
            </Reveal>
          </div>
        </div>

        <Reveal delay={0.15} className="mt-20 border-t border-line pt-10">
          <p className="max-w-3xl font-display text-2xl font-light italic leading-snug text-ink/80 md:text-3xl">
            A wrong answer, delivered confidently, costs more than silence.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
