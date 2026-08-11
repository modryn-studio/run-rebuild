import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

// Mounts every Better Auth endpoint (sign-in, callback, session, sign-out, ...) under
// /api/auth/*. The frontend talks to these via the auth client (src/lib/auth-client.ts).
export const { GET, POST } = toNextJsHandler(auth);
