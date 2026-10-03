-- CreateTable
CREATE TABLE "ztteam_fb_accounts" (
    "id" TEXT NOT NULL,
    "fb_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_token_encrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "owner_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ztteam_fb_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ztteam_pages" (
    "id" TEXT NOT NULL,
    "fb_page_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "category" TEXT,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "page_token_encrypted" TEXT NOT NULL,
    "fb_account_id" TEXT NOT NULL,
    "default_reel_template_id" TEXT,
    "token_status" TEXT NOT NULL DEFAULT 'active',
    "last_checked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ztteam_pages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ztteam_pages" ADD CONSTRAINT "ztteam_pages_fb_account_id_fkey" FOREIGN KEY ("fb_account_id") REFERENCES "ztteam_fb_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
