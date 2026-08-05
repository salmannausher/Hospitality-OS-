// Shared cursor-pagination footer for admin list pages (Knowledge Base,
// Leads, Conversations, Notifications) — matches the Stitch mockup's
// "Showing N results" + prev/next control.
//
// The API's `Paginated<T>` (packages/types) only carries `items` and
// `nextCursor` — no total count, no previous cursor. There is nothing to
// honestly render as "of 24" (that number was a Stitch mockup placeholder),
// so this shows the current page's real item count instead of a fabricated
// total. "Previous" works via a client-held cursor stack (each forward step
// pushes the cursor that produced the current page; back pops it) rather
// than a server previous-cursor, since none exists.

import { ArrowLeftIcon, ArrowRightIcon, SpinnerIcon } from "./icons";

export function Pagination({
  count,
  hasPrev,
  hasNext,
  loading = false,
  onPrev,
  onNext,
}: {
  count: number;
  hasPrev: boolean;
  hasNext: boolean;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3">
      <p className="flex items-center gap-2 text-xs text-ink-soft">
        {loading ? (
          <>
            <SpinnerIcon className="h-3.5 w-3.5 animate-spin text-brass" />
            Loading…
          </>
        ) : (
          `Showing ${count} result${count === 1 ? "" : "s"}`
        )}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev || loading}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-brass hover:text-brass disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext || loading}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-brass hover:text-brass disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft"
        >
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
