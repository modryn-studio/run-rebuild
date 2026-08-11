import { site } from '@/config/site';

// The landing page. Replace this whole file — it exists so a fresh clone renders something
// honest instead of a framework splash screen.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-display text-balance">{site.name}</h1>
      <p className="text-body-lg text-muted mt-4 text-pretty">{site.description}</p>
      <p className="text-small text-muted mt-10">
        Fresh scaffold. Fill in <code>src/config/site.ts</code>, lock the design system in{' '}
        <code>src/app/globals.css</code>, then build.
      </p>
    </main>
  );
}
