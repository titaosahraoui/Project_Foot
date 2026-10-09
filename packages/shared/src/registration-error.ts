export function hasStatus(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "status" in error && typeof (error as { status: unknown }).status === "number";
}

/** Determines if an error is caused by network failure (unreachable host, offline, timeout). */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (hasStatus(error)) return false;
  if (error instanceof TypeError) return true;
  if ("name" in error && (error.name === "TypeError" || error.name === "NetworkError")) {
    return true;
  }
  if ("message" in error && typeof (error as { message: unknown }).message === "string") {
    const msg = (error as { message: string }).message.toLowerCase();
    if (
      msg.includes("network") ||
      msg.includes("failed to fetch") ||
      msg.includes("connect") ||
      msg.includes("timeout") ||
      msg.includes("abort") ||
      msg.includes("econnrefused")
    ) {
      return true;
    }
  }
  return false;
}

/** Converts registration failures into accurate, user-facing guidance. */
export function getRegistrationErrorMessage(
  error: unknown,
  baseUrl?: string,
): string {
  if (hasStatus(error)) {
    if (error.status === 409)
      return "An account already exists with this email.";
    if (error.status === 400)
      return "Check your name, email, and password, then try again.";
    if (error.status >= 500)
      return "FootConnect server error. Please try again in a moment.";
  }

  if (baseUrl && (isNetworkError(error) || !hasStatus(error))) {
    return `Could not reach FootConnect at ${baseUrl}. Check that the API is running and this device can reach that address.`;
  }

  return "Could not create your account. Please try again.";
}

/** Converts login failures into accurate, user-facing guidance. */
export function getLoginErrorMessage(
  error: unknown,
  baseUrl?: string,
): string {
  if (hasStatus(error)) {
    if (error.status === 401)
      return "Invalid email or password.";
    if (error.status === 400)
      return "Check your email and password, then try again.";
    if (error.status === 429)
      return "Too many sign-in attempts. Please try again later.";
    if (error.status >= 500)
      return "FootConnect server error. Please try again in a moment.";
  }

  if (baseUrl && (isNetworkError(error) || !hasStatus(error))) {
    return `Could not reach FootConnect at ${baseUrl}. Check that the API is running and this device can reach that address.`;
  }

  return "Could not sign in. Please try again.";
}

