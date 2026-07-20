"use client";

import { useId, useState } from "react";
import { motion } from "motion/react";
import { Reveal, TIDE_EASE } from "@/components/Reveal";
import { ROOMS } from "@/lib/content";

const inputClasses =
  "w-full border-0 border-b border-line bg-transparent py-3 text-ink placeholder:text-ink-soft/60 focus:border-brass focus:outline-none";
const labelClasses = "text-[0.68rem] uppercase tracking-[0.18em] text-ink-soft";

export function ReserveForm() {
  const [submitted, setSubmitted] = useState(false);
  const formId = useId();

  if (submitted) {
    return (
      <Reveal className="mx-auto mt-16 max-w-xl border-t border-line pt-10 text-center">
        <p className="font-display text-2xl font-light italic text-ink">
          Thank you — we have your request.
        </p>
        <p className="mt-4 leading-relaxed text-ink-soft">
          Someone from the front desk will confirm your dates directly by
          email, usually within a day. Free cancellation until 48 hours
          before arrival.
        </p>
      </Reveal>
    );
  }

  return (
    <motion.form
      layout
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      transition={{ duration: 0.6, ease: TIDE_EASE }}
      className="mx-auto mt-16 max-w-xl space-y-8"
    >
      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-arrival`} className={labelClasses}>
            Arrival
          </label>
          <input
            id={`${formId}-arrival`}
            name="arrival"
            type="date"
            required
            className={`mt-2 ${inputClasses}`}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-departure`} className={labelClasses}>
            Departure
          </label>
          <input
            id={`${formId}-departure`}
            name="departure"
            type="date"
            required
            className={`mt-2 ${inputClasses}`}
          />
        </div>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-room`} className={labelClasses}>
            Room
          </label>
          <select
            id={`${formId}-room`}
            name="room"
            required
            defaultValue=""
            className={`mt-2 ${inputClasses}`}
          >
            <option value="" disabled>
              Choose a room
            </option>
            {ROOMS.map((room) => (
              <option key={room.slug} value={room.slug}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${formId}-guests`} className={labelClasses}>
            Guests
          </label>
          <input
            id={`${formId}-guests`}
            name="guests"
            type="number"
            min={1}
            max={6}
            defaultValue={2}
            required
            className={`mt-2 ${inputClasses}`}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-name`} className={labelClasses}>
          Name
        </label>
        <input
          id={`${formId}-name`}
          name="name"
          type="text"
          required
          placeholder="Your full name"
          className={`mt-2 ${inputClasses}`}
        />
      </div>

      <div>
        <label htmlFor={`${formId}-email`} className={labelClasses}>
          Email
        </label>
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className={`mt-2 ${inputClasses}`}
        />
      </div>

      <div>
        <label htmlFor={`${formId}-note`} className={labelClasses}>
          Anything we should know? (optional)
        </label>
        <textarea
          id={`${formId}-note`}
          name="note"
          rows={3}
          placeholder="An anniversary, a late arrival, a pet joining you…"
          className={`mt-2 resize-none ${inputClasses}`}
        />
      </div>

      <div className="pt-4 text-center">
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center bg-ink px-10 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-sand transition-colors duration-300 hover:bg-brass"
        >
          Request this stay
        </button>
        <p className="mt-4 text-xs text-ink-soft">
          No payment is taken now. Free cancellation until 48 hours before
          arrival.
        </p>
      </div>
    </motion.form>
  );
}
