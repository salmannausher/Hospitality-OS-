-- DropIndex
DROP INDEX "Amenity_hotelId_idx";

-- DropIndex
DROP INDEX "EventSpace_hotelId_idx";

-- DropIndex
DROP INDEX "Experience_hotelId_idx";

-- DropIndex
DROP INDEX "LocalRecommendation_hotelId_idx";

-- DropIndex
DROP INDEX "Package_hotelId_idx";

-- DropIndex
DROP INDEX "Policy_hotelId_topic_idx";

-- DropIndex
DROP INDEX "Restaurant_hotelId_idx";

-- DropIndex
DROP INDEX "RoomType_hotelId_idx";

-- DropIndex
DROP INDEX "SpaTreatment_hotelId_idx";

-- CreateIndex (partial — only live rows are unique; a soft-deleted row's name
-- never blocks re-creating a new one. Findings-log.md #19/#29/#32.)
CREATE UNIQUE INDEX "Amenity_hotelId_name_key" ON "Amenity"("hotelId", "name") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EventSpace_hotelId_name_key" ON "EventSpace"("hotelId", "name") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Experience_hotelId_name_key" ON "Experience"("hotelId", "name") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LocalRecommendation_hotelId_name_key" ON "LocalRecommendation"("hotelId", "name") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Package_hotelId_name_key" ON "Package"("hotelId", "name") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Policy_hotelId_topic_key" ON "Policy"("hotelId", "topic") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_hotelId_name_key" ON "Restaurant"("hotelId", "name") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_hotelId_name_key" ON "RoomType"("hotelId", "name") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SpaTreatment_hotelId_name_key" ON "SpaTreatment"("hotelId", "name") WHERE "deletedAt" IS NULL;
