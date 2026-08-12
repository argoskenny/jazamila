-- CreateTable
CREATE TABLE "r_bloglink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "b_res_id" INTEGER NOT NULL DEFAULT 0,
    "b_post_id" INTEGER NOT NULL DEFAULT 0,
    "b_blogname" TEXT,
    "b_bloglink" TEXT,
    "b_blog_show" INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY ("b_res_id") REFERENCES "r_restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "r_city" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legacy_region" INTEGER
);

-- CreateTable
CREATE TABLE "r_district" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "city_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legacy_section" INTEGER,
    FOREIGN KEY ("city_id") REFERENCES "r_city" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "r_feedback" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "f_name" TEXT,
    "f_email" TEXT,
    "f_content" TEXT,
    "f_time" INTEGER NOT NULL DEFAULT 0,
    "f_isread" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "r_post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "post_name" TEXT NOT NULL,
    "post_area_num" TEXT,
    "post_tel_num" TEXT,
    "post_region" INTEGER NOT NULL DEFAULT 0,
    "post_section" INTEGER NOT NULL DEFAULT 0,
    "post_address" TEXT,
    "post_foodtype" INTEGER NOT NULL DEFAULT 0,
    "post_price" INTEGER NOT NULL DEFAULT 0,
    "post_open_time" INTEGER NOT NULL DEFAULT 0,
    "post_close_time" INTEGER NOT NULL DEFAULT 0,
    "post_note" TEXT,
    "post_updatetime" INTEGER NOT NULL DEFAULT 0,
    "post_img_url" TEXT,
    "post_img_ori_url" TEXT,
    "post_prove" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "r_restaurant" (
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
    "city_id" INTEGER,
    "district_id" INTEGER,
    "manual_override_fields" TEXT,
    FOREIGN KEY ("district_id") REFERENCES "r_district" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("city_id") REFERENCES "r_city" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "r_restaurant_import_issue" (
    "issue_key" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "source_file" TEXT NOT NULL,
    "source_id" TEXT,
    "import_key" TEXT,
    "details" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "updated_at_unix" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "r_restaurant_tag" (
    "restaurant_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("restaurant_id", "tag_id"),
    FOREIGN KEY ("tag_id") REFERENCES "r_tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("restaurant_id") REFERENCES "r_restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "r_tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "r_bloglink_b_blog_show_idx" ON "r_bloglink"("b_blog_show" ASC);

-- CreateIndex
CREATE INDEX "r_bloglink_b_res_id_b_blog_show_idx" ON "r_bloglink"("b_res_id" ASC, "b_blog_show" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "r_city_legacy_region_key" ON "r_city"("legacy_region" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "r_city_name_key" ON "r_city"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "r_city_code_key" ON "r_city"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "r_district_city_id_legacy_section_key" ON "r_district"("city_id" ASC, "legacy_section" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "r_district_city_id_name_key" ON "r_district"("city_id" ASC, "name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "r_district_city_id_code_key" ON "r_district"("city_id" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "r_district_city_id_idx" ON "r_district"("city_id" ASC);

-- CreateIndex
CREATE INDEX "r_feedback_f_isread_idx" ON "r_feedback"("f_isread" ASC);

-- CreateIndex
CREATE INDEX "r_post_post_prove_idx" ON "r_post"("post_prove" ASC);

-- CreateIndex
CREATE INDEX "r_restaurant_source_id_idx" ON "r_restaurant"("source_id" ASC);

-- CreateIndex
CREATE INDEX "r_restaurant_city_id_district_id_idx" ON "r_restaurant"("city_id" ASC, "district_id" ASC);

-- CreateIndex
CREATE INDEX "r_restaurant_res_close_res_region_res_section_res_foodtype_res_price_idx" ON "r_restaurant"("res_close" ASC, "res_region" ASC, "res_section" ASC, "res_foodtype" ASC, "res_price" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "r_restaurant_import_key_key" ON "r_restaurant"("import_key" ASC);

-- CreateIndex
CREATE INDEX "r_restaurant_import_issue_import_key_idx" ON "r_restaurant_import_issue"("import_key" ASC);

-- CreateIndex
CREATE INDEX "r_restaurant_import_issue_status_reason_code_idx" ON "r_restaurant_import_issue"("status" ASC, "reason_code" ASC);

-- CreateIndex
CREATE INDEX "r_restaurant_tag_tag_id_idx" ON "r_restaurant_tag"("tag_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "r_tag_normalized_name_key" ON "r_tag"("normalized_name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_account_key" ON "users"("account" ASC);

