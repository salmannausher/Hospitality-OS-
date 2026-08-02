"use client";

// Admin Flow — Relationship Bundle Builder (UX §10, IA §12), Sprint 4 ticket
// 5. Visual design ported from the Stitch "Relationships" mockup (Admin
// Dashboard redesign) — including the live guest-card preview panel designed
// alongside that mockup, which turned out to already be real: `CardPreview`
// below calls the actual `/relationships/preview` endpoint (the same
// CardAssemblyService the live guest `card` event uses), not a mockup.
//
// Backend is entirely Sprint 3 work — entity CRUD/search, EntityRelationship
// CRUD, and /relationships/preview all already exist; this ticket is the
// first UI over them.
//
// Bundle model: a star topology, one anchor entity with edges to each paired
// entity (`fromEntityId: anchor, toEntityId: paired`) — matching every real
// seeded bundle (IA §12's own "Anniversary → pairs_with → X, Y, Z" example).
// Each add/remove is an immediate real POST/DELETE, never a client-side
// draft: the preview endpoint reads persisted `EntityRelationship` rows, so
// simulating it client-side would duplicate business logic the project's
// own conventions forbid. "Live" here means "re-fetches the real preview
// after every real change," not "renders unsaved state."
//
// contextTag/relationshipType are both free-text columns, not closed enums
// (IA §12) — the suggested-tag chips are shortcuts into the same free-text
// input, never a fixed dropdown.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  createRelationship,
  deleteRelationship,
  getEntity,
  listRelationships,
  previewRelationshipBundle,
  searchEntities,
  type EntityParam,
  type EntityRelationship,
  type EntitySearchResult,
  type EntityType,
  type Priority,
  type RecommendationCard,
} from "@hospitality/sdk";
import { HubIcon, PlusIcon, SearchIcon, SparkIcon } from "../../icons";

const SUGGESTED_CONTEXT_TAGS = ["anniversary", "family", "honeymoon"];
const SUGGESTED_RELATIONSHIP_TYPES = ["pairs_with", "suitable_for", "near"];
const PRIORITIES: Priority[] = ["HIGH", "NORMAL", "LOW"];

const ENTITY_TYPE_TO_PARAM: Partial<Record<EntityType, EntityParam>> = {
  ROOM_TYPE: "room-types",
  PACKAGE: "packages",
  RESTAURANT: "restaurants",
  SPA_TREATMENT: "spa-treatments",
  AMENITY: "amenities",
  POLICY: "policies",
  LOCAL_RECOMMENDATION: "local-recommendations",
  EVENT_SPACE: "event-spaces",
  EXPERIENCE: "experiences",
};
const SEARCHABLE_ENTITY_TYPES = Object.keys(ENTITY_TYPE_TO_PARAM) as EntityType[];

const ENTITY_TYPE_LABELS: Partial<Record<EntityType, string>> = {
  ROOM_TYPE: "Room Type",
  PACKAGE: "Package",
  RESTAURANT: "Restaurant",
  SPA_TREATMENT: "Spa Treatment",
  AMENITY: "Amenity",
  POLICY: "Policy",
  LOCAL_RECOMMENDATION: "Local Recommendation",
  EVENT_SPACE: "Event Space",
  EXPERIENCE: "Experience",
  PROPERTY_PROFILE: "Property",
};

function entityTypeLabel(entityType: EntityType): string {
  return ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

const inputClass =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-mist focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none";
const selectClass =
  "rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink focus:border-brass focus:ring-1 focus:ring-brass focus:outline-none";

interface AnchorEntity {
  entityType: EntityType;
  id: string;
  name: string;
}

function entityDisplayName(entity: unknown): string {
  const record = entity as Record<string, unknown>;
  if (typeof record.name === "string") return record.name;
  if (typeof record.topic === "string") return record.topic;
  return "(unknown entity)";
}

function CardPreview({ cards }: { cards: RecommendationCard[] }) {
  if (cards.length === 0) {
    return (
      <p className="text-sm text-mist">
        No cards — add entities to this bundle to see them here.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {cards.map((card) => (
        <div
          key={`${card.entityType}:${card.entityId}`}
          className="rounded-xl border border-brass/30 bg-white p-4 shadow-sm"
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-champagne/25">
              <SparkIcon className="h-3.5 w-3.5 text-brass" />
            </div>
            <span className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
              {entityTypeLabel(card.entityType)}
            </span>
          </div>
          <h4 className="mb-1 font-display text-lg text-ink">{card.title}</h4>
          <p className="mb-3 text-sm text-ink-soft">{card.hook}</p>
          {card.linkUrl && (
            <a
              href={card.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-lg bg-ink py-2 text-sm font-medium text-ivory transition-colors hover:bg-ink/90"
            >
              View Experience
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export default function RelationshipBundlesPage() {
  const { session, sessionData } = useAdminAuth();
  const accessToken = session?.access_token;
  const hotelId = sessionData?.hotelMemberships[0]?.hotelId;

  const [bundleTags, setBundleTags] = useState<string[] | null>(null);
  const [bundleCounts, setBundleCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const [contextTagInput, setContextTagInput] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [edges, setEdges] = useState<EntityRelationship[]>([]);
  const [anchor, setAnchor] = useState<AnchorEntity | null>(null);
  const [edgeNames, setEdgeNames] = useState<Record<string, string>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EntitySearchResult[]>([]);
  const [relationshipType, setRelationshipType] = useState("pairs_with");
  const [priority, setPriority] = useState<Priority>("NORMAL");

  const [previewCards, setPreviewCards] = useState<RecommendationCard[]>([]);

  const refreshBundleList = useCallback(async () => {
    if (!accessToken) return;
    try {
      const { items } = await listRelationships(accessToken, { hotelId, limit: 200 });
      const counts: Record<string, number> = {};
      for (const item of items) counts[item.contextTag] = (counts[item.contextTag] ?? 0) + 1;
      setBundleCounts(counts);
      setBundleTags(Object.keys(counts).sort());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [accessToken, hotelId]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listRelationships(accessToken, { hotelId, limit: 200 })
      .then(({ items }) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const item of items) counts[item.contextTag] = (counts[item.contextTag] ?? 0) + 1;
        setBundleCounts(counts);
        setBundleTags(Object.keys(counts).sort());
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId]);

  const loadBundle = useCallback(
    async (tag: string) => {
      if (!accessToken) return;
      try {
        const { items } = await listRelationships(accessToken, { hotelId, contextTag: tag, limit: 100 });
        setEdges(items);
        if (items.length > 0) {
          const first = items[0];
          setAnchor({ entityType: first.fromEntityType, id: first.fromEntityId, name: "…" });
        } else {
          setAnchor(null);
        }
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [accessToken, hotelId],
  );

  const refreshPreview = useCallback(
    async (tag: string) => {
      if (!accessToken) return;
      try {
        const { cards } = await previewRelationshipBundle(accessToken, tag, { hotelId });
        setPreviewCards(cards);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [accessToken, hotelId],
  );

  // Resolve display names for the anchor + every edge's "to" entity — the
  // list/preview endpoints return ids only, never denormalized names.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const idsToResolve = new Map<string, EntityType>();
    if (anchor) idsToResolve.set(anchor.id, anchor.entityType);
    for (const edge of edges) idsToResolve.set(edge.toEntityId, edge.toEntityType);

    (async () => {
      const resolved: Record<string, string> = {};
      for (const [id, entityType] of idsToResolve) {
        const param = ENTITY_TYPE_TO_PARAM[entityType];
        if (!param) continue;
        try {
          const entity = await getEntity(accessToken, param, id, { hotelId });
          resolved[id] = entityDisplayName(entity);
        } catch {
          resolved[id] = "(unknown entity)";
        }
      }
      if (!cancelled) setEdgeNames((prev) => ({ ...prev, ...resolved }));
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelId, anchor, edges]);

  function openBundle(tag: string) {
    setSelectedTag(tag);
    setContextTagInput(tag);
    setSearchResults([]);
    setSearchQuery("");
    void loadBundle(tag);
    void refreshPreview(tag);
  }

  function startNewBundle() {
    const tag = contextTagInput.trim();
    if (!tag) return;
    setSelectedTag(tag);
    setEdges([]);
    setAnchor(null);
    setPreviewCards([]);
    setSearchResults([]);
    setSearchQuery("");
    void refreshPreview(tag);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !searchQuery.trim()) return;
    try {
      const results = await searchEntities(accessToken, {
        q: searchQuery,
        types: SEARCHABLE_ENTITY_TYPES,
        hotelId,
      });
      setSearchResults(results);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function pickResult(result: EntitySearchResult) {
    if (!accessToken || !selectedTag) return;
    setSearchResults([]);
    setSearchQuery("");
    setEdgeNames((prev) => ({ ...prev, [result.id]: result.name }));

    if (!anchor) {
      setAnchor({ entityType: result.entityType, id: result.id, name: result.name });
      return;
    }
    try {
      await createRelationship(
        accessToken,
        {
          fromEntityType: anchor.entityType,
          fromEntityId: anchor.id,
          toEntityType: result.entityType,
          toEntityId: result.id,
          relationshipType,
          contextTag: selectedTag,
          priority,
        },
        { hotelId },
      );
      await loadBundle(selectedTag);
      await refreshPreview(selectedTag);
      await refreshBundleList();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeEdge(edge: EntityRelationship) {
    if (!accessToken || !selectedTag) return;
    try {
      await deleteRelationship(accessToken, edge.id, { hotelId });
      await loadBundle(selectedTag);
      await refreshPreview(selectedTag);
      await refreshBundleList();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const suggestedTagsToShow = useMemo(
    () => SUGGESTED_CONTEXT_TAGS.filter((tag) => !(bundleTags ?? []).includes(tag)),
    [bundleTags],
  );

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Relationships</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Manage intelligent context tags and curated bundles. Define how the AI OS identifies and
          personalizes guest experiences based on their unique occasions.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <h2 className="font-display text-xl text-ink">Existing Bundles</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            {bundleTags === null ? (
              <p className="p-6 text-sm text-ink-soft">Loading…</p>
            ) : bundleTags.length === 0 ? (
              <p className="p-6 text-sm text-mist">No bundles yet — open one from the right.</p>
            ) : (
              bundleTags.map((tag, i) => (
                <button
                  key={tag}
                  onClick={() => openBundle(tag)}
                  className={`flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-parchment/40 ${
                    i > 0 ? "border-t border-line" : ""
                  } ${selectedTag === tag ? "bg-champagne/10" : ""}`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-champagne/25 text-brass">
                    <HubIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-ink">{tag}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {bundleCounts[tag] ?? 0} active service{bundleCounts[tag] === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedTag && (
            <div className="rounded-xl border border-line bg-white p-6">
              <p className="mb-4 text-sm font-semibold text-ink">
                Bundle: <span className="rounded bg-parchment px-2 py-0.5 font-mono text-xs">{selectedTag}</span>
              </p>

              {anchor ? (
                <p className="mb-4 text-sm text-ink-soft">
                  Anchor: <span className="font-medium text-ink">{edgeNames[anchor.id] ?? anchor.name}</span>{" "}
                  ({entityTypeLabel(anchor.entityType)})
                </p>
              ) : (
                <p className="mb-4 text-sm text-mist">
                  Search for an entity below to set it as this bundle&apos;s anchor.
                </p>
              )}

              {edges.length > 0 && (
                <ul className="mb-4 flex flex-col gap-2">
                  {edges.map((edge) => (
                    <li
                      key={edge.id}
                      className="flex items-center justify-between rounded-lg bg-parchment/40 px-3 py-2 text-sm"
                    >
                      <span className="text-ink-soft">
                        <span className="text-ink">{edge.relationshipType}</span> →{" "}
                        <span className="font-medium text-ink">
                          {edgeNames[edge.toEntityId] ?? edge.toEntityId}
                        </span>{" "}
                        ({entityTypeLabel(edge.toEntityType)}, {edge.priority})
                      </span>
                      <button
                        onClick={() => void removeEdge(edge)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={(e) => void handleSearch(e)} className="mb-3 flex gap-2">
                <div className="relative flex-1">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-mist" />
                  <input
                    type="text"
                    placeholder="Search entities (e.g. Ocean View Suite)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`${inputClass} w-full pl-9`}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-parchment"
                >
                  Search
                </button>
              </form>

              {anchor && (
                <div className="mb-3 flex flex-wrap items-end gap-4">
                  <label className="flex flex-col gap-1 text-xs text-ink-soft">
                    <span className="font-semibold tracking-wide uppercase">Relationship type</span>
                    <input
                      type="text"
                      list="suggested-relationship-types"
                      value={relationshipType}
                      onChange={(e) => setRelationshipType(e.target.value)}
                      className={`${inputClass} w-40`}
                    />
                    <datalist id="suggested-relationship-types">
                      {SUGGESTED_RELATIONSHIP_TYPES.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-ink-soft">
                    <span className="font-semibold tracking-wide uppercase">Priority</span>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                      className={selectClass}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {searchResults.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {searchResults.map((result) => (
                    <li key={`${result.entityType}:${result.id}`}>
                      <button
                        onClick={() => void pickResult(result)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-parchment/60"
                      >
                        {result.name}{" "}
                        <span className="text-xs text-ink-soft">({entityTypeLabel(result.entityType)})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="relative overflow-hidden rounded-xl border-l-2 border-brass bg-white p-6 shadow-sm">
            <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-champagne/20 blur-2xl" />
            <div className="relative z-10">
              <div className="mb-3 flex items-center gap-2">
                <SparkIcon className="h-4 w-4 text-brass" />
                <h3 className="font-display text-lg text-ink">AI Context Mapper</h3>
              </div>
              <p className="mb-4 text-sm text-ink-soft">
                Open or create a new bundle by mapping a context tag detected by the AI in guest
                communications.
              </p>
              <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-soft uppercase">
                Context Tag
              </label>
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., anniversary, birthday"
                  value={contextTagInput}
                  onChange={(e) => setContextTagInput(e.target.value)}
                  className={`${inputClass} flex-1`}
                />
                <button
                  onClick={startNewBundle}
                  className="flex items-center gap-1 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-ink/90"
                >
                  <PlusIcon className="h-4 w-4" />
                  Open
                </button>
              </div>
              {suggestedTagsToShow.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    Suggested Tags
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTagsToShow.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setContextTagInput(tag)}
                        className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-brass hover:text-brass"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line bg-parchment/40 px-5 py-3">
              <span className="text-xs font-semibold tracking-widest text-ink-soft uppercase">
                Live Preview
              </span>
              <span className="text-xs font-semibold tracking-widest text-brass uppercase">
                Guest View
              </span>
            </div>
            <div className="bg-parchment/20 p-5">
              {selectedTag ? (
                <CardPreview cards={previewCards} />
              ) : (
                <p className="text-sm text-mist">Open a bundle to preview what guests will see.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
