function hasStatus(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "status" in error;
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
  }

  if (error instanceof TypeError && baseUrl) {
    return `Could not reach FootConnect at ${baseUrl}. Check that the API is running and this device can reach that address.`;
  }

  return "Could not create your account. Please try again.";
}
