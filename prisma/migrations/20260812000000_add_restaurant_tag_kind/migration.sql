-- Make the cuisine/auxiliary distinction explicit on each restaurant-tag
-- relation while preserving the original tag and its source trace.
ALTER TABLE "r_restaurant_tag" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'auxiliary';
ALTER TABLE "r_restaurant_tag" ADD COLUMN "visibility_reason" TEXT;

CREATE INDEX "r_restaurant_tag_restaurant_id_kind_is_public_idx"
  ON "r_restaurant_tag"("restaurant_id", "kind", "is_public");
