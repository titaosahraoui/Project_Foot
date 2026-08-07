import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { errorHandler, notFound } from "./middleware/error-handler";
import { requestId } from "./middleware/request-id";
import { healthRouter } from "./modules/health/health.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { teamsRouter } from "./modules/teams/teams.routes";
import { pitchesRouter } from "./modules/pitches/pitches.routes";
import { bookingsRouter } from "./modules/bookings/bookings.routes";
import { matchesRouter } from "./modules/matches/matches.routes";
import { socialRouter } from "./modules/social/social.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestId);
  app.use(pinoHttp({ logger }));

  // Health is unversioned and at the root for load balancers / probes.
  app.use("/health", healthRouter);

  // Versioned API. Each module owns its base path.
  const api = express.Router();
  api.use("/auth", authRouter);
  api.use("/users", usersRouter);
  api.use("/teams", teamsRouter);
  api.use("/pitches", pitchesRouter);
  api.use("/bookings", bookingsRouter);
  api.use("/matches", matchesRouter);
  api.use("/social", socialRouter);
  api.use("/notifications", notificationsRouter);
  app.use("/api/v1", api);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
