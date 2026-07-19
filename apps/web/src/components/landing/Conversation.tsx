"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Kicker } from "./Kicker";
import { EASE_OUT } from "./Reveal";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.95, delayChildren: 0.4 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_OUT } },
};

function Guest({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={item} className="flex justify-end">
      <p className="max-w-[85%] rounded-xl rounded-br-sm border border-ivory/10 bg-ivory/[0.07] px-5 py-4 leading-relaxed text-ivory/90">
        {children}
      </p>
    </motion.div>
  );
}

function Concierge({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={item} className="flex gap-4">
      <span
        aria-hidden
        className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-champagne/50 font-display text-lg italic text-champagne"
      >
        B
      </span>
      <div className="min-w-0 max-w-[85%]">
        <p className="text-[0.62rem] uppercase tracking-[0.22em] text-champagne/80">
          Bellevue Hotel · Concierge
        </p>
        <div className="mt-2 space-y-4 leading-relaxed text-ivory/90">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

export function Conversation() {
  return (
    <section
      id="demo"
      className="grain relative bg-night px-6 py-28 text-ivory md:py-40"
    >
      <div className="relative mx-auto max-w-2xl">
        <Kicker index="02" tone="dark">
          In practice
        </Kicker>

        <h2 className="mt-8 font-display text-4xl font-light leading-[1.12] md:text-5xl">
          A guest writes at midnight.
        </h2>

        <p className="mt-10 text-center text-[0.68rem] uppercase tracking-[0.26em] text-mist">
          Tuesday · 11:52 pm
        </p>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-20% 0px" }}
          className="mt-12 space-y-10"
        >
          <Guest>
            Hi — we land close to midnight. Is check-in still possible that
            late?
          </Guest>

          <Concierge>
            <p>
              Of course. The desk is staffed through the night, and I have
              noted your late arrival so the team expects you. May I have a
              light supper waiting in the room?
            </p>
          </Concierge>

          <Guest>
            That would be lovely. It&rsquo;s actually our tenth anniversary.
          </Guest>

          <Concierge>
            <p>
              Congratulations. Then, if I may — the Ocean-View Suite for your
              nights with us, a couples massage at the spa, and a private
              dinner on the terrace. I can ask reservations to hold all three.
            </p>
            <div className="mt-6 border border-champagne/25 bg-ivory/[0.04]">
              <div
                aria-hidden
                className="h-36 w-full bg-gradient-to-b from-[#33414b] via-[#6d5b41] to-[#c8a76b]"
              />
              <div className="p-5">
                <p className="font-display text-xl text-ivory">
                  The Anniversary Evening
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-mist">
                  Ocean-view suite · couples massage · private dinner on the
                  terrace — held as one reservation.
                </p>
              </div>
            </div>
          </Concierge>

          <motion.p
            variants={item}
            className="border-t border-ivory/10 pt-10 text-center leading-relaxed text-mist"
          >
            No script. No decision tree. It knows the property — and it
            recognizes an anniversary when it hears one.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
