import { Spinner } from '@/components/ui/spinner';

// Root route-level loading state. Deliberately quiet: a full-screen brand animation on every
// navigation is a cost the user pays for nothing.
export default function Loading() {
  return (
    <div className="text-muted flex min-h-dvh items-center justify-center" role="status" aria-label="Loading">
      <Spinner />
    </div>
  );
}
