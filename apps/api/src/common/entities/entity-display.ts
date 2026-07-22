import type { EntityConfig } from './entity-config';

/**
 * Derives a guest-facing card's `title`/`hook` (API §2.1 `RecommendationCard`)
 * from an entity row. **Deliberate interim decision, flagged rather than
 * silently guessed** (discussed with the user before building — see
 * docs/14-sprint-backlog.md Sprint 3): no entity table or `EntityRelationship`
 * row has an admin-authored copy field for this, so `hook` is generated
 * deterministically from each type's existing fields rather than stored or
 * model-generated. This matches AI Engine §1's call inventory, which has no
 * card-assembly model call, and §4's reranking, which is deterministic too.
 * Real admin-authored bundle copy (and `imageUrl`/`linkUrl`, both optional in
 * the type and left `null` here) is an open design question, not settled by
 * this code — a schema addition (to `EntityRelationship` or the entity
 * tables) is the likely real fix, not a decision to make silently in a
 * template function.
 */
export function buildTitle(
  config: EntityConfig,
  row: Record<string, unknown>,
): string {
  const value = row[config.searchField];
  return typeof value === 'string' ? value : '';
}

export function buildHook(
  config: EntityConfig,
  row: Record<string, unknown>,
): string {
  const parts: Array<string | null> = (() => {
    switch (config.model) {
      case 'roomType':
        return [
          str(row.view) ? `${str(row.view)} view` : null,
          typeof row.capacity === 'number' ? `sleeps ${row.capacity}` : null,
        ];
      case 'package':
        return [
          Array.isArray(row.includedItems) && row.includedItems.length
            ? (row.includedItems as unknown[])
                .filter(isString)
                .slice(0, 2)
                .join(', ')
            : null,
          money(row.priceLow) ? `from $${money(row.priceLow)}` : null,
        ];
      case 'restaurant':
        return [str(row.cuisine), str(row.hours)];
      case 'spaTreatment':
        return [
          typeof row.durationMins === 'number'
            ? `${row.durationMins} min`
            : null,
          money(row.price) ? `$${money(row.price)}` : null,
        ];
      case 'amenity':
        return [str(row.hours), str(row.location)];
      case 'policy':
        return [truncate(str(row.ruleText) ?? '', 80)];
      case 'localRecommendation':
        return [str(row.category), str(row.distanceNote)];
      case 'eventSpace':
        return [
          typeof row.capacity === 'number' ? `seats ${row.capacity}` : null,
          Array.isArray(row.layoutOptions) && row.layoutOptions.length
            ? ((row.layoutOptions as unknown[]).find(isString) ?? null)
            : null,
          money(row.cateringMinimum)
            ? `from $${money(row.cateringMinimum)} minimum`
            : null,
        ];
      case 'experience':
        return [
          str(row.category),
          typeof row.durationMins === 'number'
            ? `${row.durationMins} min`
            : null,
          money(row.price) ? `$${money(row.price)}` : null,
        ];
      default:
        return [];
    }
  })();
  return parts.filter((p): p is string => Boolean(p)).join(' · ');
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Decimal fields (Prisma's `Decimal`) arrive here type-erased to `unknown`
 * (the entity delegate is resolved dynamically by model name — see
 * `card-assembly.service.ts`); narrow to the shapes that can actually occur
 * (`number`, or an object with its own `toString`, i.e. Prisma's `Decimal`)
 * rather than stringifying a bare `unknown`. */
function money(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'toString' in value) {
    return (value as { toString(): string }).toString();
  }
  return null;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
