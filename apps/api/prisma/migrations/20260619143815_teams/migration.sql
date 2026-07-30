-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('CAPTAIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "skillRating" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_memberships_teamId_userId_key" ON "team_memberships"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_teamId_inviteeId_key" ON "invitations"("teamId", "inviteeId");

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
