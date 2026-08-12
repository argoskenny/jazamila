-- Add the controlled canonical cuisine catalog and the nullable
-- single-cuisine relation without changing the legacy res_foodtype column.
CREATE TABLE "r_cuisine_type" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT NOT NULL DEFAULT 'seed',
    "legacy_foodtype" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- SQLite requires rebuilding the table to add the foreign key while
-- preserving the existing Restaurant rows and their legacy columns.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_r_restaurant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "res_name" TEXT NOT NULL,
    "res_area_num" TEXT,
    "res_tel_num" TEXT,
    "res_region" INTEGER NOT NULL DEFAULT 0,
    "res_section" INTEGER NOT NULL DEFAULT 0,
    "res_address" TEXT,
    "res_foodtype" INTEGER NOT NULL DEFAULT 0,
    "res_price" INTEGER NOT NULL DEFAULT 0,
    "res_open_time" INTEGER NOT NULL DEFAULT 0,
    "res_close_time" INTEGER NOT NULL DEFAULT 0,
    "res_note" TEXT,
    "res_img_url" TEXT,
    "res_img_ori_url" TEXT,
    "res_updatetime" INTEGER,
    "res_post_id" INTEGER NOT NULL DEFAULT 0,
    "res_close" INTEGER NOT NULL DEFAULT 0,
    "import_key" TEXT,
    "source_id" TEXT,
    "source_file" TEXT,
    "source_refs_json" TEXT,
    "phone" TEXT,
    "res_price_min" INTEGER,
    "res_price_max" INTEGER,
    "rating_platform" TEXT,
    "rating_score" REAL,
    "rating_review_count" INTEGER,
    "review_summary_json" TEXT,
    "business_open_time" TEXT,
    "business_close_time" TEXT,
    "external_image_url" TEXT,
    "manual_override_fields" TEXT,
    "city_id" INTEGER,
    "district_id" INTEGER,
    "cuisine_type_id" INTEGER,
    CONSTRAINT "r_restaurant_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "r_city" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "r_restaurant_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "r_district" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "r_restaurant_cuisine_type_id_fkey" FOREIGN KEY ("cuisine_type_id") REFERENCES "r_cuisine_type" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_r_restaurant" ("business_close_time", "business_open_time", "city_id", "district_id", "external_image_url", "id", "import_key", "manual_override_fields", "phone", "rating_platform", "rating_review_count", "rating_score", "res_address", "res_area_num", "res_close", "res_close_time", "res_foodtype", "res_img_ori_url", "res_img_url", "res_name", "res_note", "res_open_time", "res_post_id", "res_price", "res_price_max", "res_price_min", "res_region", "res_section", "res_tel_num", "res_updatetime", "review_summary_json", "source_file", "source_id", "source_refs_json") SELECT "business_close_time", "business_open_time", "city_id", "district_id", "external_image_url", "id", "import_key", "manual_override_fields", "phone", "rating_platform", "rating_review_count", "rating_score", "res_address", "res_area_num", "res_close", "res_close_time", "res_foodtype", "res_img_ori_url", "res_img_url", "res_name", "res_note", "res_open_time", "res_post_id", "res_price", "res_price_max", "res_price_min", "res_region", "res_section", "res_tel_num", "res_updatetime", "review_summary_json", "source_file", "source_id", "source_refs_json" FROM "r_restaurant";
DROP TABLE "r_restaurant";
ALTER TABLE "new_r_restaurant" RENAME TO "r_restaurant";
CREATE UNIQUE INDEX "r_restaurant_import_key_key" ON "r_restaurant"("import_key");
CREATE INDEX "r_restaurant_res_close_res_region_res_section_res_foodtype_res_price_idx" ON "r_restaurant"("res_close", "res_region", "res_section", "res_foodtype", "res_price");
CREATE INDEX "r_restaurant_city_id_district_id_idx" ON "r_restaurant"("city_id", "district_id");
CREATE INDEX "r_restaurant_cuisine_type_id_idx" ON "r_restaurant"("cuisine_type_id");
CREATE INDEX "r_restaurant_source_id_idx" ON "r_restaurant"("source_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "r_cuisine_type_code_key" ON "r_cuisine_type"("code");
CREATE UNIQUE INDEX "r_cuisine_type_normalized_name_key" ON "r_cuisine_type"("normalized_name");
CREATE UNIQUE INDEX "r_cuisine_type_legacy_foodtype_key" ON "r_cuisine_type"("legacy_foodtype");
CREATE INDEX "r_cuisine_type_status_idx" ON "r_cuisine_type"("status");
