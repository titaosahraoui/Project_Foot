/**
 * Adapter for checking future matches for a team.
 * Returns false until Milestone 09 implements matches.service.
 */
export async function hasConfirmedFutureMatches(_teamId: string): Promise<boolean> {
  return false;
}
