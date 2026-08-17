import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import {
  authHeader,
  disconnectTestDependencies,
  registerTestUser,
  uniqueEmail,
} from "../../test/integration-helpers";

const app = createApp();

const captainEmail = uniqueEmail("captain");
const member1Email = uniqueEmail("member1");
const member2Email = uniqueEmail("member2");
const member3Email = uniqueEmail("member3");
const member4Email = uniqueEmail("member4");
const outsiderEmail = uniqueEmail("outsider");
const password = "password123";

let captainToken = "";
let captainId = "";
let member1Token = "";
let member1Id = "";
let member2Token = "";
let member2Id = "";
let member3Token = "";
let member3Id = "";
let member4Token = "";
let member4Id = "";
let outsiderToken = "";
let outsiderId = "";

let teamId = "";

beforeAll(async () => {
  const cap = await registerTestUser(app, {
    email: captainEmail,
    password,
    displayName: "Captain User",
  });
  captainToken = cap.accessToken;
  captainId = cap.user.id;

  const m1 = await registerTestUser(app, {
    email: member1Email,
    password,
    displayName: "Member 1",
  });
  member1Token = m1.accessToken;
  member1Id = m1.user.id;

  const m2 = await registerTestUser(app, {
    email: member2Email,
    password,
    displayName: "Member 2",
  });
  member2Token = m2.accessToken;
  member2Id = m2.user.id;

  const m3 = await registerTestUser(app, {
    email: member3Email,
    password,
    displayName: "Member 3",
  });
  member3Token = m3.accessToken;
  member3Id = m3.user.id;

  const m4 = await registerTestUser(app, {
    email: member4Email,
    password,
    displayName: "Member 4",
  });
  member4Token = m4.accessToken;
  member4Id = m4.user.id;

  const out = await registerTestUser(app, {
    email: outsiderEmail,
    password,
    displayName: "Outsider User",
  });
  outsiderToken = out.accessToken;
  outsiderId = out.user.id;
});

afterAll(async () => {
  if (teamId) {
    await prisma.team.deleteMany({ where: { id: teamId } });
  }
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          captainEmail,
          member1Email,
          member2Email,
          member3Email,
          member4Email,
          outsiderEmail,
        ],
      },
    },
  });
  await disconnectTestDependencies();
});

describe("Teams and Competitive Identity (Milestone 04 Integration)", () => {
  describe("M04-T01: Ratings ownership & Team Creation", () => {
    it("creates a team with atomic initial TeamRating and competitive summary", async () => {
      const res = await request(app)
        .post("/api/v1/teams")
        .set(authHeader(captainToken))
        .send({ name: "El Bahia FC" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("El Bahia FC");
      expect(res.body.status).toBe("ACTIVE");
      expect(res.body.memberCount).toBe(1);
      expect(res.body.competitive).toEqual({
        rating: 1000,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      });
      teamId = res.body.id;

      // Verify directly that TeamRating record exists
      const dbRating = await prisma.teamRating.findUnique({
        where: { teamId },
      });
      expect(dbRating).not.toBeNull();
      expect(dbRating?.rating).toBe(1000);
      expect(dbRating?.matchesPlayed).toBe(0);
      expect(dbRating?.wins).toBe(0);
      expect(dbRating?.draws).toBe(0);
      expect(dbRating?.losses).toBe(0);
    });

    it("fetches team detail including competitive state and status", async () => {
      const res = await request(app)
        .get(`/api/v1/teams/${teamId}`)
        .set(authHeader(captainToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(teamId);
      expect(res.body.status).toBe("ACTIVE");
      expect(res.body.competitive).toEqual({
        rating: 1000,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      });
    });
  });

  describe("M04-T03: Player Cards", () => {
    it("projects member to FootConnect PlayerCard format without private fields", async () => {
      const res = await request(app)
        .get(`/api/v1/teams/${teamId}`)
        .set(authHeader(captainToken));

      expect(res.status).toBe(200);
      const members = res.body.members;
      expect(members).toHaveLength(1);

      const captainCard = members[0];
      expect(captainCard.userId).toBe(captainId);
      expect(captainCard.displayName).toBe("Captain User");
      expect(captainCard.teamRole).toBe("CAPTAIN");
      expect(captainCard.cardTheme).toBe("FOOTCONNECT_BASE");
      expect(captainCard.verifiedAppearances).toBe(0);
      expect(captainCard.joinedAt).toBeDefined();

      // Ensure private user fields do not leak
      expect((captainCard as Record<string, unknown>).email).toBeUndefined();
      expect((captainCard as Record<string, unknown>).passwordHash).toBeUndefined();
      expect((captainCard as Record<string, unknown>).lat).toBeUndefined();
      expect((captainCard as Record<string, unknown>).lng).toBeUndefined();
    });
  });

  describe("Invitations and Roster Growth", () => {
    async function inviteAndAccept(userToken: string, userEmail: string) {
      const invRes = await request(app)
        .post(`/api/v1/teams/${teamId}/invitations`)
        .set(authHeader(captainToken))
        .send({ email: userEmail });
      expect(invRes.status).toBe(201);

      const pendingRes = await request(app)
        .get("/api/v1/teams/invitations")
        .set(authHeader(userToken));
      expect(pendingRes.status).toBe(200);
      const inv = pendingRes.body.find((i: { team: { id: string } }) => i.team.id === teamId);
      expect(inv).toBeDefined();

      const acceptRes = await request(app)
        .post(`/api/v1/teams/invitations/${inv.id}/accept`)
        .set(authHeader(userToken));
      expect(acceptRes.status).toBe(200);
    }

    it("invites and accepts member1, member2, member3, member4 to reach 5 active players", async () => {
      await inviteAndAccept(member1Token, member1Email);
      await inviteAndAccept(member2Token, member2Email);
      await inviteAndAccept(member3Token, member3Email);
      await inviteAndAccept(member4Token, member4Email);

      const teamRes = await request(app)
        .get(`/api/v1/teams/${teamId}`)
        .set(authHeader(captainToken));
      expect(teamRes.status).toBe(200);
      expect(teamRes.body.memberCount).toBe(5);
      expect(teamRes.body.members).toHaveLength(5);
    });
  });

  describe("M04-T04: Formations and Current Lineups", () => {
    it("allows active captain to set a valid 5v5 lineup", async () => {
      const res = await request(app)
        .put(`/api/v1/teams/${teamId}/lineups/FIVE_A_SIDE`)
        .set(authHeader(captainToken))
        .send({
          formationCode: "1-2-1",
          slots: [
            { userId: captainId, positionCode: "GK", sortOrder: 0 },
            { userId: member1Id, positionCode: "LB", sortOrder: 1 },
            { userId: member2Id, positionCode: "RB", sortOrder: 2 },
            { userId: member3Id, positionCode: "CM", sortOrder: 3 },
            { userId: member4Id, positionCode: "ST", sortOrder: 4 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.teamId).toBe(teamId);
      expect(res.body.format).toBe("FIVE_A_SIDE");
      expect(res.body.formationCode).toBe("1-2-1");
      expect(res.body.slots).toHaveLength(5);
      expect(res.body.slots[0].positionCode).toBe("GK");
      expect(res.body.slots[0].userId).toBe(captainId);
    });

    it("returns saved lineups for the team", async () => {
      const res = await request(app)
        .get(`/api/v1/teams/${teamId}/lineups`)
        .set(authHeader(member1Token));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].format).toBe("FIVE_A_SIDE");
      expect(res.body[0].formationCode).toBe("1-2-1");
    });

    it("blocks non-captain from setting a lineup", async () => {
      const res = await request(app)
        .put(`/api/v1/teams/${teamId}/lineups/FIVE_A_SIDE`)
        .set(authHeader(member1Token))
        .send({
          formationCode: "1-2-1",
          slots: [
            { userId: captainId, positionCode: "GK", sortOrder: 0 },
            { userId: member1Id, positionCode: "LB", sortOrder: 1 },
            { userId: member2Id, positionCode: "RB", sortOrder: 2 },
            { userId: member3Id, positionCode: "CM", sortOrder: 3 },
            { userId: member4Id, positionCode: "ST", sortOrder: 4 },
          ],
        });

      expect(res.status).toBe(403);
    });

    it("rejects lineup with invalid slot count", async () => {
      const res = await request(app)
        .put(`/api/v1/teams/${teamId}/lineups/FIVE_A_SIDE`)
        .set(authHeader(captainToken))
        .send({
          formationCode: "1-2-1",
          slots: [
            { userId: captainId, positionCode: "GK", sortOrder: 0 },
            { userId: member1Id, positionCode: "LB", sortOrder: 1 },
            { userId: member2Id, positionCode: "RB", sortOrder: 2 },
            { userId: member3Id, positionCode: "CM", sortOrder: 3 },
          ],
        });

      expect(res.status).toBe(400);
    });

    it("rejects lineup with non-member user", async () => {
      const res = await request(app)
        .put(`/api/v1/teams/${teamId}/lineups/FIVE_A_SIDE`)
        .set(authHeader(captainToken))
        .send({
          formationCode: "1-2-1",
          slots: [
            { userId: captainId, positionCode: "GK", sortOrder: 0 },
            { userId: member1Id, positionCode: "LB", sortOrder: 1 },
            { userId: member2Id, positionCode: "RB", sortOrder: 2 },
            { userId: member3Id, positionCode: "CM", sortOrder: 3 },
            { userId: outsiderId, positionCode: "ST", sortOrder: 4 },
          ],
        });

      expect(res.status).toBe(400);
    });

    it("rejects lineup with invalid position code", async () => {
      const res = await request(app)
        .put(`/api/v1/teams/${teamId}/lineups/FIVE_A_SIDE`)
        .set(authHeader(captainToken))
        .send({
          formationCode: "1-2-1",
          slots: [
            { userId: captainId, positionCode: "GK", sortOrder: 0 },
            { userId: member1Id, positionCode: "LB", sortOrder: 1 },
            { userId: member2Id, positionCode: "RB", sortOrder: 2 },
            { userId: member3Id, positionCode: "CM", sortOrder: 3 },
            { userId: member4Id, positionCode: "LCM", sortOrder: 4 },
          ],
        });

      expect(res.status).toBe(400);
    });
  });

  describe("M04-T02: Captain Transfer", () => {
    it("rejects self-transfer", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/captain-transfer`)
        .set(authHeader(captainToken))
        .send({ newCaptainUserId: captainId });

      expect(res.status).toBe(409);
    });

    it("rejects transfer to a non-member", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/captain-transfer`)
        .set(authHeader(captainToken))
        .send({ newCaptainUserId: outsiderId });

      expect(res.status).toBe(409);
    });

    it("rejects captain transfer initiated by non-captain", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/captain-transfer`)
        .set(authHeader(member1Token))
        .send({ newCaptainUserId: member2Id });

      expect(res.status).toBe(403);
    });

    it("successfully transfers captaincy from captain to member1", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/captain-transfer`)
        .set(authHeader(captainToken))
        .send({ newCaptainUserId: member1Id });

      expect(res.status).toBe(200);

      const oldCapMember = res.body.members.find(
        (m: { userId: string }) => m.userId === captainId,
      );
      const newCapMember = res.body.members.find(
        (m: { userId: string }) => m.userId === member1Id,
      );

      expect(oldCapMember.teamRole).toBe("MEMBER");
      expect(newCapMember.teamRole).toBe("CAPTAIN");
    });

    it("blocks former captain from captain-only actions after transfer", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/invitations`)
        .set(authHeader(captainToken))
        .send({ email: outsiderEmail });

      expect(res.status).toBe(403);
    });

    it("allows new captain to perform captain actions", async () => {
      const res = await request(app)
        .patch(`/api/v1/teams/${teamId}`)
        .set(authHeader(member1Token))
        .send({ name: "El Bahia FC Champions" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("El Bahia FC Champions");
    });

    it("allows former captain to leave the squad now that they are a regular member", async () => {
      const res = await request(app)
        .delete(`/api/v1/teams/${teamId}/members/${captainId}`)
        .set(authHeader(captainToken));

      expect(res.status).toBe(204);

      const teamRes = await request(app)
        .get(`/api/v1/teams/${teamId}`)
        .set(authHeader(member1Token));

      expect(teamRes.body.memberCount).toBe(4);
      const foundOldCap = teamRes.body.members.find(
        (m: { userId: string }) => m.userId === captainId,
      );
      expect(foundOldCap).toBeUndefined();
    });

    it("blocks current captain from leaving without transferring captaincy", async () => {
      const res = await request(app)
        .delete(`/api/v1/teams/${teamId}/members/${member1Id}`)
        .set(authHeader(member1Token));

      expect(res.status).toBe(400);
    });
  });

  describe("M04-T06: Team Lifecycle & Authorization Invariants", () => {
    it("allows captain to archive team", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/archive`)
        .set(authHeader(member1Token));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ARCHIVED");
    });

    it("is idempotent when archiving an already archived team", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/archive`)
        .set(authHeader(member1Token));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ARCHIVED");
    });

    it("rejects mutations on an archived team", async () => {
      // Update team info
      const updateRes = await request(app)
        .patch(`/api/v1/teams/${teamId}`)
        .set(authHeader(member1Token))
        .send({ name: "Archived Rename" });
      expect(updateRes.status).toBe(409);

      // Captain transfer
      const transferRes = await request(app)
        .post(`/api/v1/teams/${teamId}/captain-transfer`)
        .set(authHeader(member1Token))
        .send({ newCaptainUserId: member2Id });
      expect(transferRes.status).toBe(409);

      // Lineup update
      const lineupRes = await request(app)
        .put(`/api/v1/teams/${teamId}/lineups/FIVE_A_SIDE`)
        .set(authHeader(member1Token))
        .send({
          formationCode: "1-2-1",
          slots: [
            { userId: member1Id, positionCode: "GK", sortOrder: 0 },
            { userId: member2Id, positionCode: "LB", sortOrder: 1 },
            { userId: member3Id, positionCode: "RB", sortOrder: 2 },
            { userId: member4Id, positionCode: "CM", sortOrder: 3 },
          ],
        });
      expect(lineupRes.status).toBe(409);

      // Member removal
      const removeRes = await request(app)
        .delete(`/api/v1/teams/${teamId}/members/${member2Id}`)
        .set(authHeader(member1Token));
      expect(removeRes.status).toBe(409);

      // Sending invitation
      const inviteRes = await request(app)
        .post(`/api/v1/teams/${teamId}/invitations`)
        .set(authHeader(member1Token))
        .send({ email: outsiderEmail });
      expect(inviteRes.status).toBe(409);
    });

    it("allows captain to reactivate archived team", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/reactivate`)
        .set(authHeader(member1Token));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ACTIVE");
    });

    it("is idempotent when reactivating an active team", async () => {
      const res = await request(app)
        .post(`/api/v1/teams/${teamId}/reactivate`)
        .set(authHeader(member1Token));

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ACTIVE");
    });

    it("allows mutations after reactivation", async () => {
      const res = await request(app)
        .patch(`/api/v1/teams/${teamId}`)
        .set(authHeader(member1Token))
        .send({ name: "El Bahia FC Reactivated" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("El Bahia FC Reactivated");
    });

    it("requires authentication for all team endpoints", async () => {
      const unauthGet = await request(app).get(`/api/v1/teams/${teamId}`);
      expect(unauthGet.status).toBe(401);

      const unauthMine = await request(app).get("/api/v1/teams/mine");
      expect(unauthMine.status).toBe(401);

      const unauthPost = await request(app).post("/api/v1/teams").send({ name: "Unauth FC" });
      expect(unauthPost.status).toBe(401);
    });
  });
});
