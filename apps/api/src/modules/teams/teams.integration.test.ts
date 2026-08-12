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
const memberEmail = uniqueEmail("member");
const password = "password123";

let captainToken = "";
let memberToken = "";
let memberId = "";
let teamId = "";
let invitationId = "";

beforeAll(async () => {
  const cap = await registerTestUser(app, { email: captainEmail, password, displayName: "Captain" });
  captainToken = cap.accessToken;
  const mem = await registerTestUser(app, { email: memberEmail, password, displayName: "Member" });
  memberToken = mem.accessToken;
  memberId = mem.user.id;
});

afterAll(async () => {
  if (teamId) await prisma.team.deleteMany({ where: { id: teamId } });
  await prisma.user.deleteMany({ where: { email: { in: [captainEmail, memberEmail] } } });
  await disconnectTestDependencies();
});

describe("teams flow (integration)", () => {
  it("creates a team with the creator as captain", async () => {
    const res = await request(app)
      .post("/api/v1/teams")
      .set(authHeader(captainToken))
      .send({ name: "FC Test" });
    expect(res.status).toBe(201);
    expect(res.body.memberCount).toBe(1);
    expect(res.body.members[0].role).toBe("CAPTAIN");
    teamId = res.body.id;
  });

  it("rejects inviting an unknown email", async () => {
    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set(authHeader(captainToken))
      .send({ email: "nobody@nowhere.test" });
    expect(res.status).toBe(404);
  });

  it("lets the captain invite a registered user", async () => {
    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set(authHeader(captainToken))
      .send({ email: memberEmail });
    expect(res.status).toBe(201);
  });

  it("blocks a non-captain from inviting", async () => {
    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set(authHeader(memberToken))
      .send({ email: "someone@else.test" });
    expect(res.status).toBe(403);
  });

  it("shows the invitee their pending invitation", async () => {
    const res = await request(app).get("/api/v1/teams/invitations").set(authHeader(memberToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].team.id).toBe(teamId);
    invitationId = res.body[0].id;
  });

  it("accepts the invitation and grows the roster to 2", async () => {
    const res = await request(app)
      .post(`/api/v1/teams/invitations/${invitationId}/accept`)
      .set(authHeader(memberToken));
    expect(res.status).toBe(200);
    expect(res.body.memberCount).toBe(2);
  });

  it("rejects re-inviting an existing member", async () => {
    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set(authHeader(captainToken))
      .send({ email: memberEmail });
    expect(res.status).toBe(409);
  });

  it("lets a member leave, shrinking the roster", async () => {
    const leave = await request(app)
      .delete(`/api/v1/teams/${teamId}/members/${memberId}`)
      .set(authHeader(memberToken));
    expect(leave.status).toBe(204);

    const team = await request(app).get(`/api/v1/teams/${teamId}`).set(authHeader(captainToken));
    expect(team.body.memberCount).toBe(1);
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/v1/teams/mine");
    expect(res.status).toBe(401);
  });
});
