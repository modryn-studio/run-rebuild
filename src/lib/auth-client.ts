// Better Auth client for the frontend. Sign-in is an emailed 6-digit code + Google; the server
// half is src/lib/auth.ts. baseURL defaults to the app origin.
import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
