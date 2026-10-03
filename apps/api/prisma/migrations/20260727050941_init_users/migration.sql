-- CreateEnum
CREATE TYPE "ZTTeamRole" AS ENUM ('ADMIN', 'MANAGER', 'EDITOR');

-- CreateEnum
CREATE TYPE "ZTTeamAssetType" AS ENUM ('SITE', 'PAGE');

-- CreateTable
CREATE TABLE "ztteam_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "ZTTeamRole" NOT NULL DEFAULT 'EDITOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ztteam_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ztteam_user_assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_type" "ZTTeamAssetType" NOT NULL,
    "asset_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ztteam_user_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ztteam_users_email_key" ON "ztteam_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ztteam_user_assets_user_id_asset_type_asset_id_key" ON "ztteam_user_assets"("user_id", "asset_type", "asset_id");

-- AddForeignKey
ALTER TABLE "ztteam_user_assets" ADD CONSTRAINT "ztteam_user_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ztteam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
