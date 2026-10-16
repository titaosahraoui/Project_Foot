export interface ActionGuardState<T extends string = string> {
  actionInProgress: T | null;
  lastAction: T | null;
  actionError: string | null;
}

export type ActionStatus = "STARTED" | "BLOCKED" | "COMPLETED" | "FAILED";

export interface ActionExecutionResult<R> {
  status: ActionStatus;
  result?: R;
  error?: string;
}

export async function executeGuardedAction<T extends string, R>(
  action: T,
  state: {
    actionInProgress: T | null;
    setActionInProgress: (action: T | null) => void;
    setLastAction: (action: T) => void;
    setActionError: (error: string | null) => void;
  },
  task: () => Promise<R>,
  onError?: (error: unknown) => void,
): Promise<ActionExecutionResult<R>> {
  if (state.actionInProgress !== null) {
    return { status: "BLOCKED" };
  }

  state.setActionInProgress(action);
  state.setLastAction(action);
  state.setActionError(null);

  try {
    const res = await task();
    return { status: "COMPLETED", result: res };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Failed to execute action. Please check your network and retry.";
    state.setActionError(msg);
    if (onError) {
      onError(err);
    }
    return { status: "FAILED", error: msg };
  } finally {
    state.setActionInProgress(null);
  }
}
