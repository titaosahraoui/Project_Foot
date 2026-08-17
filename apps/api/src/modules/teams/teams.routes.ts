import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { requireAuth } from "../../middleware/require-auth";
import * as c from "./teams.controller";

export const teamsRouter: Router = Router();

// All team routes require authentication.
teamsRouter.use(requireAuth);

// Static routes must come before the dynamic "/:id" routes.
teamsRouter.get("/invitations", asyncHandler(c.myInvitationsHandler));
teamsRouter.post("/invitations/:id/accept", asyncHandler(c.acceptInvitationHandler));
teamsRouter.post("/invitations/:id/decline", asyncHandler(c.declineInvitationHandler));
teamsRouter.get("/mine", asyncHandler(c.getMyTeamsHandler));

teamsRouter.post("/", asyncHandler(c.createTeamHandler));
teamsRouter.get("/:id", asyncHandler(c.getTeamHandler));
teamsRouter.patch("/:id", asyncHandler(c.updateTeamHandler));
teamsRouter.post("/:id/captain-transfer", asyncHandler(c.transferCaptainHandler));
teamsRouter.post("/:id/archive", asyncHandler(c.archiveTeamHandler));
teamsRouter.post("/:id/reactivate", asyncHandler(c.reactivateTeamHandler));
teamsRouter.get("/:id/lineups", asyncHandler(c.getLineupsHandler));
teamsRouter.put("/:id/lineups/:format", asyncHandler(c.setLineupHandler));
teamsRouter.post("/:id/invitations", asyncHandler(c.inviteHandler));
teamsRouter.delete("/:id/members/:userId", asyncHandler(c.removeMemberHandler));
