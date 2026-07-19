
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'AGENCY_ADMIN', 'HOTEL_ADMIN', 'MARKETING', 'RESERVATIONS', 'VIEWER');

-- CreateEnum
CREATE TYPE "TonePreset" AS ENUM ('CLASSIC_LUXURY', 'MODERN_LUXURY', 'BOUTIQUE', 'FAMILY_FRIENDLY');

-- CreateEnum
CREATE TYPE "DocumentSourceType" AS ENUM ('PDF', 'DOCX', 'TEXT', 'URL');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PARSING', 'NEEDS_REVIEW', 'FAILED', 'INDEXED');

-- CreateEnum
CREATE TYPE "IngestionStage" AS ENUM ('PARSING', 'EXTRACTING', 'CHUNKING', 'TAGGING', 'EMBEDDING', 'VALIDATING');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('ROOM_TYPE', 'PACKAGE', 'RESTAURANT', 'SPA_TREATMENT', 'AMENITY', 'POLICY', 'LOCAL_RECOMMENDATION', 'EVENT_SPACE', 'EXPERIENCE', 'PROPERTY_PROFILE');

-- CreateEnum
CREATE TYPE "JourneyState" AS ENUM ('information', 'planning', 'booking_intent', 'service_recovery');

-- CreateEnum
CREATE TYPE "ConfidenceBand" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('GUEST', 'CONCIERGE');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "ScenarioSource" AS ENUM ('HAND_WRITTEN', 'PILOT_TRANSCRIPT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_LEAD', 'ESCALATION', 'INGESTION_FAILED', 'SYSTEM_ERROR', 'WEEKLY_REPORT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('CLOUDBEDS', 'MEWS', 'OPERA', 'SALESFORCE', 'HUBSPOT');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "HotelMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetKey" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSettings" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "conciergeName" TEXT NOT NULL,
    "tonePreset" "TonePreset" NOT NULL DEFAULT 'MODERN_LUXURY',
    "formalityNote" TEXT,
    "emojiAllowed" BOOLEAN NOT NULL DEFAULT false,
    "signOff" TEXT,
    "greeting" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "fontFamily" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptOverride" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "overrideText" TEXT NOT NULL,
    "model" TEXT,
    "temperature" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sourceType" "DocumentSourceType" NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PARSING',
    "sourceUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "stage" "IngestionStage" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "domainTags" TEXT[],
    "sourceType" "DocumentSourceType" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "embedding" vector(1024) NOT NULL,

    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "view" TEXT,
    "capacity" INTEGER NOT NULL,
    "bedConfig" TEXT,
    "accessible" BOOLEAN NOT NULL DEFAULT false,
    "baseRateLow" DECIMAL(65,30),
    "baseRateHigh" DECIMAL(65,30),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "includedItems" TEXT[],
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "priceLow" DECIMAL(65,30),
    "priceHigh" DECIMAL(65,30),
    "roomTypeIds" TEXT[],
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuisine" TEXT,
    "hours" TEXT,
    "dressCode" TEXT,
    "dietaryTags" TEXT[],
    "reservationPolicy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaTreatment" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMins" INTEGER,
    "price" DECIMAL(65,30),
    "facility" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SpaTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hours" TEXT,
    "location" TEXT,
    "accessRule" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "ruleText" TEXT NOT NULL,
    "exceptions" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalRecommendation" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "distanceNote" TEXT,
    "curationNote" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LocalRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSpace" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "layoutOptions" TEXT[],
    "avEquipment" TEXT[],
    "cateringMinimum" DECIMAL(65,30),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "durationMins" INTEGER,
    "price" DECIMAL(65,30),
    "bookingLeadHrs" INTEGER,
    "ageRestriction" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyProfile" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "brandStory" TEXT,
    "history" TEXT,
    "location" TEXT,
    "contactInfo" TEXT,
    "galleryRefs" TEXT[],
    "awards" TEXT[],
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "petFriendly" BOOLEAN,
    "starRating" INTEGER,
    "airportDistanceNote" TEXT,
    "quickFactAmenities" TEXT[],

    CONSTRAINT "PropertyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityRelationship" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "fromEntityType" "EntityType" NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityType" "EntityType" NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "contextTag" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',

    CONSTRAINT "EntityRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "guestSessionId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "journeyState" "JourneyState",
    "domainTags" TEXT[],
    "confidenceBand" "ConfidenceBand",
    "escalationTriggered" BOOLEAN NOT NULL DEFAULT false,
    "leadCaptureTriggered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "conversationId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "travelDates" TEXT,
    "budget" TEXT,
    "guestCount" INTEGER,
    "reasonForStay" TEXT,
    "preferredRoom" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "leadScore" INTEGER,
    "assignedOwnerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escalation" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "handledBy" TEXT,

    CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QAScore" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "grounding" INTEGER NOT NULL,
    "tone" INTEGER NOT NULL,
    "escalation" INTEGER NOT NULL,
    "leadCapture" INTEGER NOT NULL,
    "resolution" INTEGER NOT NULL,
    "scoredBy" TEXT NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QAScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookScenario" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT,
    "domain" TEXT,
    "journeyState" "JourneyState" NOT NULL,
    "persona" TEXT,
    "guestMessage" TEXT NOT NULL,
    "expectedBehavior" TEXT[],
    "escalationExpected" BOOLEAN NOT NULL DEFAULT false,
    "leadCaptureExpected" BOOLEAN NOT NULL DEFAULT false,
    "mustNot" TEXT[],
    "source" "ScenarioSource" NOT NULL DEFAULT 'HAND_WRITTEN',
    "sourceConversationId" TEXT,

    CONSTRAINT "PlaybookScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "secretRef" TEXT,
    "configuration" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'STARTER',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "monthlyRate" DECIMAL(65,30),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "conversationCount" INTEGER NOT NULL DEFAULT 0,
    "bookingIntentCount" INTEGER NOT NULL DEFAULT 0,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "escalationCount" INTEGER NOT NULL DEFAULT 0,
    "avgSatisfaction" DOUBLE PRECISION,

    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_slug_key" ON "Hotel"("slug");

-- CreateIndex
CREATE INDEX "Hotel_organizationId_idx" ON "Hotel"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "HotelMembership_hotelId_idx" ON "HotelMembership"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelMembership_userId_hotelId_key" ON "HotelMembership"("userId", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetKey_key_key" ON "WidgetKey"("key");

-- CreateIndex
CREATE INDEX "WidgetKey_hotelId_idx" ON "WidgetKey"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandSettings_hotelId_key" ON "BrandSettings"("hotelId");

-- CreateIndex
CREATE INDEX "PromptOverride_hotelId_active_idx" ON "PromptOverride"("hotelId", "active");

-- CreateIndex
CREATE INDEX "Document_hotelId_status_idx" ON "Document"("hotelId", "status");

-- CreateIndex
CREATE INDEX "IngestionJob_hotelId_idx" ON "IngestionJob"("hotelId");

-- CreateIndex
CREATE INDEX "IngestionJob_documentId_idx" ON "IngestionJob"("documentId");

-- CreateIndex
CREATE INDEX "Chunk_hotelId_priority_idx" ON "Chunk"("hotelId", "priority");

-- CreateIndex
CREATE INDEX "RoomType_hotelId_idx" ON "RoomType"("hotelId");

-- CreateIndex
CREATE INDEX "Package_hotelId_idx" ON "Package"("hotelId");

-- CreateIndex
CREATE INDEX "Restaurant_hotelId_idx" ON "Restaurant"("hotelId");

-- CreateIndex
CREATE INDEX "SpaTreatment_hotelId_idx" ON "SpaTreatment"("hotelId");

-- CreateIndex
CREATE INDEX "Amenity_hotelId_idx" ON "Amenity"("hotelId");

-- CreateIndex
CREATE INDEX "Policy_hotelId_topic_idx" ON "Policy"("hotelId", "topic");

-- CreateIndex
CREATE INDEX "LocalRecommendation_hotelId_idx" ON "LocalRecommendation"("hotelId");

-- CreateIndex
CREATE INDEX "EventSpace_hotelId_idx" ON "EventSpace"("hotelId");

-- CreateIndex
CREATE INDEX "Experience_hotelId_idx" ON "Experience"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyProfile_hotelId_key" ON "PropertyProfile"("hotelId");

-- CreateIndex
CREATE INDEX "EntityRelationship_hotelId_contextTag_idx" ON "EntityRelationship"("hotelId", "contextTag");

-- CreateIndex
CREATE INDEX "Conversation_hotelId_startedAt_idx" ON "Conversation"("hotelId", "startedAt");

-- CreateIndex
CREATE INDEX "Message_hotelId_idx" ON "Message"("hotelId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_hotelId_status_idx" ON "Lead"("hotelId", "status");

-- CreateIndex
CREATE INDEX "Escalation_hotelId_reason_idx" ON "Escalation"("hotelId", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "QAScore_conversationId_key" ON "QAScore"("conversationId");

-- CreateIndex
CREATE INDEX "QAScore_hotelId_idx" ON "QAScore"("hotelId");

-- CreateIndex
CREATE INDEX "PlaybookScenario_hotelId_journeyState_idx" ON "PlaybookScenario"("hotelId", "journeyState");

-- CreateIndex
CREATE INDEX "AuditLog_hotelId_createdAt_idx" ON "AuditLog"("hotelId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_hotelId_status_idx" ON "Notification"("hotelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_hotelId_provider_key" ON "Integration"("hotelId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_hotelId_key" ON "Subscription"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_hotelId_date_key" ON "DailyMetric"("hotelId", "date");

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelMembership" ADD CONSTRAINT "HotelMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelMembership" ADD CONSTRAINT "HotelMembership_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetKey" ADD CONSTRAINT "WidgetKey_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSettings" ADD CONSTRAINT "BrandSettings_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptOverride" ADD CONSTRAINT "PromptOverride_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaTreatment" ADD CONSTRAINT "SpaTreatment_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amenity" ADD CONSTRAINT "Amenity_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalRecommendation" ADD CONSTRAINT "LocalRecommendation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSpace" ADD CONSTRAINT "EventSpace_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyProfile" ADD CONSTRAINT "PropertyProfile_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelationship" ADD CONSTRAINT "EntityRelationship_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QAScore" ADD CONSTRAINT "QAScore_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookScenario" ADD CONSTRAINT "PlaybookScenario_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMetric" ADD CONSTRAINT "DailyMetric_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

