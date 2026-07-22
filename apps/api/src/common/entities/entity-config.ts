import type { EntityType } from '@hospitality/types';

export type EntityModelName =
  | 'roomType'
  | 'package'
  | 'restaurant'
  | 'spaTreatment'
  | 'amenity'
  | 'policy'
  | 'localRecommendation'
  | 'eventSpace'
  | 'experience';

export type FieldType =
  'string' | 'int' | 'decimal' | 'boolean' | 'stringArray' | 'date';

export interface FieldSpec {
  name: string;
  type: FieldType;
  required?: boolean;
}

export interface EntityConfig {
  /** Prisma `EntityType` enum value — also what `EntityRelationship` rows reference. */
  entityType: EntityType;
  /** Prisma client delegate name, e.g. `roomType` for `tx.roomType`. */
  model: EntityModelName;
  /** Field `search()` matches against with a case-insensitive `contains`. */
  searchField: string;
  fields: FieldSpec[];
}

/**
 * The nine structured-entity tables (DB §6) keyed by the kebab-case route
 * param API §3.3 uses for `:type` (`GET/POST/PATCH/DELETE
 * /v1/admin/entities/:type[/:id]`). `PropertyProfile` is deliberately excluded
 * — DB §6 documents it separately as a hotel-wide singleton (no list, no
 * `:id`), not one of "the nine", and no endpoint shape for it exists in the
 * API spec yet.
 *
 * Field lists mirror `apps/api/src/knowledge/ingestion.service.ts`'s
 * `writeEntities()` exactly, which is the existing source of truth for how
 * each entity's Prisma model maps to real-world fields.
 *
 * Lives in `common/` (not `admin/entities/`) because it's shared by more than
 * the entity CRUD surface: `ai/card-assembly.service.ts` (Sprint 3 ticket 2)
 * reuses `searchField` as each type's display-name field when resolving an
 * `EntityRelationship` edge to a guest-facing card — one registry, not a
 * second copy of "which field is the title" re-typed per consumer.
 */
export const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  'room-types': {
    entityType: 'ROOM_TYPE',
    model: 'roomType',
    searchField: 'name',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'view', type: 'string' },
      { name: 'capacity', type: 'int', required: true },
      { name: 'bedConfig', type: 'string' },
      { name: 'accessible', type: 'boolean' },
      { name: 'baseRateLow', type: 'decimal' },
      { name: 'baseRateHigh', type: 'decimal' },
    ],
  },
  packages: {
    entityType: 'PACKAGE',
    model: 'package',
    searchField: 'name',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'includedItems', type: 'stringArray' },
      { name: 'validFrom', type: 'date' },
      { name: 'validTo', type: 'date' },
      { name: 'priceLow', type: 'decimal' },
      { name: 'priceHigh', type: 'decimal' },
      { name: 'roomTypeIds', type: 'stringArray' },
    ],
  },
  restaurants: {
    entityType: 'RESTAURANT',
    model: 'restaurant',
    searchField: 'name',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'cuisine', type: 'string' },
      { name: 'hours', type: 'string' },
      { name: 'dressCode', type: 'string' },
      { name: 'dietaryTags', type: 'stringArray' },
      { name: 'reservationPolicy', type: 'string' },
    ],
  },
  'spa-treatments': {
    entityType: 'SPA_TREATMENT',
    model: 'spaTreatment',
    searchField: 'name',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'durationMins', type: 'int' },
      { name: 'price', type: 'decimal' },
      { name: 'facility', type: 'string' },
    ],
  },
  amenities: {
    entityType: 'AMENITY',
    model: 'amenity',
    searchField: 'name',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'hours', type: 'string' },
      { name: 'location', type: 'string' },
      { name: 'accessRule', type: 'string' },
    ],
  },
  policies: {
    entityType: 'POLICY',
    model: 'policy',
    searchField: 'topic',
    fields: [
      { name: 'topic', type: 'string', required: true },
      { name: 'ruleText', type: 'string', required: true },
      { name: 'exceptions', type: 'string' },
    ],
  },
  'local-recommendations': {
    entityType: 'LOCAL_RECOMMENDATION',
    model: 'localRecommendation',
    searchField: 'name',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'category', type: 'string' },
      { name: 'distanceNote', type: 'string' },
      { name: 'curationNote', type: 'string' },
    ],
  },
  'event-spaces': {
    entityType: 'EVENT_SPACE',
    model: 'eventSpace',
    searchField: 'name',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'capacity', type: 'int' },
      { name: 'layoutOptions', type: 'stringArray' },
      { name: 'avEquipment', type: 'stringArray' },
      { name: 'cateringMinimum', type: 'decimal' },
    ],
  },
  experiences: {
    entityType: 'EXPERIENCE',
    model: 'experience',
    searchField: 'name',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'category', type: 'string' },
      { name: 'durationMins', type: 'int' },
      { name: 'price', type: 'decimal' },
      { name: 'bookingLeadHrs', type: 'int' },
      { name: 'ageRestriction', type: 'string' },
    ],
  },
};
