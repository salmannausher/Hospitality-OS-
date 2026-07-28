"use client";

// Admin Flow — Relationship Bundle Builder (UX §10, IA §12), Sprint 4 ticket
// 5. Bare/unstyled, matching the rest of the protected shell (no design
// system yet, Sprint 5 decision pending). Backend is entirely Sprint 3 work —
// entity CRUD/search, EntityRelationship CRUD, and /relationships/preview
// all already exist; this ticket is the first UI over them.
//
// Bundle model: a star topology, one anchor entity with edges to each paired
// entity (`fromEntityId: anchor, toEntityId: paired`) — matching every real
// seeded bundle (IA §12's own "Anniversary → pairs_with → X, Y, Z" example).
// Each add/remove is an immediate real POST/DELETE, never a client-side
// draft: the preview endpoint reads persisted `EntityRelationship` rows
// through the same CardAssemblyService the live guest `card` event uses, so
// simulating it client-side would duplicate business logic the project's
// own conventions forbid. "Live" here means "re-fetches the real preview
// after every real change," not "renders unsaved state."
//
// contextTag/relationshipType are both free-text columns, not closed enums
// (IA §12) — suggested values only, never a fixed dropdown.

import { useCallback, useEffect, useState } from "react";
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
    return <p style={{ color: "#999" }}>No cards — add entities to this bundle to see them here.</p>;
  }
  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      {cards.map((card) => (
        <div
          key={`${card.entityType}:${card.entityId}`}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "0.75rem",
            width: 180,
          }}
        >
          <p style={{ fontSize: "0.7rem", color: "#999", marginBottom: "0.25rem" }}>{card.entityType}</p>
          <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{card.title}</p>
          <p style={{ fontSize: "0.85rem", color: "#666" }}>{card.hook}</p>
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
      const tags = [...new Set(items.map((r) => r.contextTag))].sort();
      setBundleTags(tags);
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
        setBundleTags([...new Set(items.map((r) => r.contextTag))].sort());
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

  return (
    <div>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Relationships</h1>

      {error && <p style={{ color: "crimson", marginBottom: "1rem" }}>{error}</p>}

      <section style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Existing bundles</p>
        {bundleTags === null ? (
          <p>Loading…</p>
        ) : bundleTags.length === 0 ? (
          <p style={{ color: "#999" }}>No bundles yet — start one below.</p>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {bundleTags.map((tag) => (
              <button
                key={tag}
                onClick={() => openBundle(tag)}
                style={{ fontWeight: selectedTag === tag ? 700 : 400 }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>New / open a bundle by context tag</p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            list="suggested-context-tags"
            placeholder="anniversary"
            value={contextTagInput}
            onChange={(e) => setContextTagInput(e.target.value)}
            style={{ width: 200 }}
          />
          <datalist id="suggested-context-tags">
            {SUGGESTED_CONTEXT_TAGS.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          <button onClick={startNewBundle}>Open</button>
        </div>
      </section>

      {selectedTag && (
        <section style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div style={{ minWidth: 320 }}>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Bundle: <code>{selectedTag}</code>
            </p>

            {anchor ? (
              <p style={{ marginBottom: "0.5rem" }}>
                Anchor: <strong>{edgeNames[anchor.id] ?? anchor.name}</strong> ({anchor.entityType})
              </p>
            ) : (
              <p style={{ color: "#999", marginBottom: "0.5rem" }}>
                Search for an entity below to set it as this bundle&apos;s anchor.
              </p>
            )}

            {edges.length > 0 && (
              <ul style={{ margin: "0 0 1rem", paddingLeft: "1.25rem" }}>
                {edges.map((edge) => (
                  <li key={edge.id} style={{ marginBottom: "0.25rem" }}>
                    {edge.relationshipType} → {edgeNames[edge.toEntityId] ?? edge.toEntityId} (
                    {edge.toEntityType}, {edge.priority}){" "}
                    <button onClick={() => void removeEdge(edge)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={(e) => void handleSearch(e)} style={{ marginBottom: "0.5rem" }}>
              <input
                type="text"
                placeholder="Search entities (e.g. Ocean View Suite)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: 260 }}
              />
              <button type="submit">Search</button>
            </form>

            {anchor && (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.85rem" }}>
                  Relationship type{" "}
                  <input
                    type="text"
                    list="suggested-relationship-types"
                    value={relationshipType}
                    onChange={(e) => setRelationshipType(e.target.value)}
                    style={{ width: 140 }}
                  />
                  <datalist id="suggested-relationship-types">
                    {SUGGESTED_RELATIONSHIP_TYPES.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </label>
                <label style={{ fontSize: "0.85rem" }}>
                  Priority{" "}
                  <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
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
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {searchResults.map((result) => (
                  <li key={`${result.entityType}:${result.id}`}>
                    <button onClick={() => void pickResult(result)}>
                      {result.name} ({result.entityType})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Live preview — what the concierge shows for &quot;{selectedTag}&quot;
            </p>
            <CardPreview cards={previewCards} />
          </div>
        </section>
      )}
    </div>
  );
}
