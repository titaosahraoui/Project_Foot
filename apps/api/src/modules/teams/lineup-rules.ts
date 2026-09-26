import type { FormatCode, SetTeamLineupInput } from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";

export interface FormationConfig {
  formationCode: string;
  playerCount: number;
  positions: string[];
}

export const SUPPORTED_FORMATIONS: Record<FormatCode, FormationConfig> = {
  FIVE_A_SIDE: {
    formationCode: "1-2-1",
    playerCount: 5,
    positions: ["GK", "LB", "RB", "CM", "ST"],
  },
  SEVEN_A_SIDE: {
    formationCode: "2-3-1",
    playerCount: 7,
    positions: ["GK", "LCB", "RCB", "LM", "CM", "RM", "ST"],
  },
  ELEVEN_A_SIDE: {
    formationCode: "4-4-2",
    playerCount: 11,
    positions: ["GK", "LB", "LCB", "RCB", "RB", "LM", "LCM", "RCM", "RM", "LST", "RST"],
  },
};

export function validateLineup(
  format: FormatCode,
  input: SetTeamLineupInput,
  activeMemberUserIds: Set<string>,
): void {
  const config = SUPPORTED_FORMATIONS[format];
  if (!config) {
    throw new HttpError(400, `Unsupported match format: ${format}`);
  }

  if (input.formationCode !== config.formationCode) {
    throw new HttpError(
      400,
      `Unsupported formation code '${input.formationCode}' for format ${format}. Expected '${config.formationCode}'.`,
    );
  }

  if (input.slots.length !== config.playerCount) {
    throw new HttpError(
      400,
      `Lineup for format ${format} requires exactly ${config.playerCount} players, but received ${input.slots.length}.`,
    );
  }

  const seenUserIds = new Set<string>();
  const seenSortOrders = new Set<number>();
  const seenPositions = new Set<string>();
  let gkCount = 0;

  for (const slot of input.slots) {
    if (!activeMemberUserIds.has(slot.userId)) {
      throw new HttpError(400, `User '${slot.userId}' is not an active member of this team.`);
    }

    if (seenUserIds.has(slot.userId)) {
      throw new HttpError(400, `Duplicate player in lineup: ${slot.userId}`);
    }
    seenUserIds.add(slot.userId);

    if (slot.sortOrder < 0 || slot.sortOrder >= config.playerCount) {
      throw new HttpError(
        400,
        `Invalid sort order ${slot.sortOrder}. Sort orders must range from 0 to ${config.playerCount - 1}.`,
      );
    }
    if (seenSortOrders.has(slot.sortOrder)) {
      throw new HttpError(400, `Duplicate sort order: ${slot.sortOrder}`);
    }
    seenSortOrders.add(slot.sortOrder);

    if (!config.positions.includes(slot.positionCode)) {
      throw new HttpError(
        400,
        `Invalid position code '${slot.positionCode}' for formation ${config.formationCode}.`,
      );
    }
    if (seenPositions.has(slot.positionCode)) {
      throw new HttpError(400, `Duplicate position in lineup: ${slot.positionCode}`);
    }
    seenPositions.add(slot.positionCode);

    if (slot.positionCode === "GK") {
      gkCount++;
    }
  }

  if (gkCount !== 1) {
    throw new HttpError(400, `Lineup must contain exactly 1 GK, but found ${gkCount}.`);
  }

  for (let i = 0; i < config.playerCount; i++) {
    if (!seenSortOrders.has(i)) {
      throw new HttpError(
        400,
        `Missing sort order index ${i}. Sort orders must be contiguous from 0 to ${config.playerCount - 1}.`,
      );
    }
  }
}
