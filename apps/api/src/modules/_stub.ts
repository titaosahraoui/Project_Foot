import { Router } from "express";

/**
 * Builds a placeholder router for a bounded context not yet implemented.
 * Each context is fleshed out in its own roadmap phase following the
 * routes -> controller -> service -> repository convention (see README.md).
 */
export function createStubRouter(name: string): Router {
  const router = Router();
  router.all("*", (_req, res) => {
    res.status(501).json({ message: `Module "${name}" is not implemented yet.` });
  });
  return router;
}
