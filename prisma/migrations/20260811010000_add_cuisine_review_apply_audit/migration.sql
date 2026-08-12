-- Preserve source tags while recording whether a relation is owned by the
-- importer, the classifier, or a human editor. Public queries can hide a
-- source cuisine tag without losing its provenance.
ALTER TABLE "r_restaurant_tag" ADD COLUMN "owner" TEXT NOT NULL DEFAULT 'source';
ALTER TABLE "r_restaurant_tag" ADD COLUMN "source_name" TEXT;
ALTER TABLE "r_restaurant_tag" ADD COLUMN "is_public" INTEGER NOT NULL DEFAULT 1;
-- SQLite only permits constant defaults when adding a required column to a
-- populated table. Prisma supplies current timestamps for new writes.
ALTER TABLE "r_restaurant_tag" ADD COLUMN "created_at" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE "r_restaurant_tag" ADD COLUMN "updated_at" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';
CREATE INDEX "r_restaurant_tag_restaurant_id_is_public_idx" ON "r_restaurant_tag"("restaurant_id", "is_public");

-- The batch and change log are written in the same transaction as the
-- restaurant/tag update, so an apply either has a complete before/after
-- record or has no visible effect.
CREATE TABLE "r_cuisine_apply_batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "source" TEXT NOT NULL,
    "created_by" TEXT NOT NULL DEFAULT 'manual',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolled_back_at" DATETIME
);

CREATE TABLE "r_cuisine_apply_change" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batch_id" TEXT NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "input_fingerprint" TEXT NOT NULL,
    "before_json" TEXT NOT NULL,
    "after_json" TEXT NOT NULL,
    "decision_json" TEXT NOT NULL,
    "action_status" TEXT NOT NULL DEFAULT 'applied',
    "protected_fields_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "r_cuisine_apply_change_batch_id_fkey"
      FOREIGN KEY ("batch_id") REFERENCES "r_cuisine_apply_batch" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "r_cuisine_apply_change_restaurant_id_fkey"
      FOREIGN KEY ("restaurant_id") REFERENCES "r_restaurant" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "r_cuisine_apply_change_batch_id_restaurant_id_key"
  ON "r_cuisine_apply_change"("batch_id", "restaurant_id");
CREATE INDEX "r_cuisine_apply_change_restaurant_id_idx"
  ON "r_cuisine_apply_change"("restaurant_id");
CREATE INDEX "r_cuisine_apply_batch_status_idx"
  ON "r_cuisine_apply_batch"("status");
