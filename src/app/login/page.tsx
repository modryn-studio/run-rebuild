import { Login } from '@/components/views/auth/login';

// Identity-first: the login screen is the front door (route /login for now; enforcing it as the
// app entry for unauthenticated visitors is a follow-up, see GitHub issue #17).
// No min-h-dvh here - Login owns the shell height (h-dvh); duplicating it would make 200dvh the
// moment Login is composed alongside anything else.
export default function LoginPage() {
  return (
    <main>
      <Login />
    </main>
  );
}
