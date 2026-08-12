import { site } from '@/config/site';

// The door. One honest sentence until there is something to let people into — a marketing
// surface is a phase 7 job, and a landing page that oversells an unbuilt product is the
// first place a trust-led product can lose.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-display text-balance">{site.name}</h1>
      <p className="text-body-lg text-muted mt-4 text-pretty">{site.description}</p>
      <p className="text-small text-muted mt-10">Still being built, and not open for signups yet.</p>
    </main>
  );
}
