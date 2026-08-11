// Typed HTTP errors so lib functions can signal 401/403/404 and route catch-blocks map
// them to the right status without bespoke branching in every handler.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class AuthError extends HttpError {
  constructor(message = 'Not authenticated') {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

// A state conflict, not a permission problem: the resource exists and the caller may touch it, but
// its current state forbids this action (e.g. arming a line on an already-closed session). Added so
// the arm route could stop matching on `error.message.includes('already closed')`, which broke
// silently the moment that string was reworded.
export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}

// Returns a JSON error Response for a known HttpError, or null to let the caller 500.
export function httpErrorResponse(error: unknown): Response | null {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  return null;
}
