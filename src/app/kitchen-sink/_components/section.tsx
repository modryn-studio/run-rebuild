// Layout scaffolding for the sink, and nothing else. These carry no colour, size or radius
// decisions of their own — every value they use is a token, so recolouring the system recolours
// the page that inspects it. See the rule in CLAUDE.md: no literal values under this route.

export function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    /* scroll-mt is measured against <main>, not the viewport: the shell locks the page at h-dvh
       and <main> is the scrollport, so an anchor jump lands the heading at the top of the pane.
       The 8 is breathing room, not clearance for a sticky bar. There is no sticky bar any more:
       navigation moved to the sidebar. */
    <section id={id} className="border-border scroll-mt-8 border-t pt-12 pb-4">
      <h2 className="text-h2">{title}</h2>
      {/* Full ink, not muted: this is prose meant to be READ. Muted is for metadata. */}
      {intro && <p className="text-body mt-2 max-w-2xl text-pretty">{intro}</p>}
      <div className="mt-8 flex flex-col gap-12">{children}</div>
    </section>
  );
}

// One labelled specimen. The label is the thing you grep for when a screen needs this state.
export function Row({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* Metadata: a caption naming the specimen below, not something you read for meaning. */}
        <h3 className="text-caption text-muted uppercase">{label}</h3>
        {note && <p className="text-small text-muted">{note}</p>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

// A finding the page wants you to read, not a specimen. Used for the things only a rendered
// page can tell you: what the font actually resolved to, which pair misses AA.
export function Note({ tone = 'muted', children }: { tone?: 'muted' | 'danger'; children: React.ReactNode }) {
  return (
    // A finding is prose, so it takes full ink. Only the label above it is metadata.
    <p className={tone === 'danger' ? 'text-small text-danger' : 'text-small'}>{children}</p>
  );
}

// Verdict pill. Deliberately carries a word as well as a colour — colour alone fails anyone who
// cannot see the difference, which is a strange way to report an accessibility result.
export function Verdict({ pass, children }: { pass: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        pass
          ? 'text-success text-caption border-success inline-flex rounded-sm border px-2 py-1'
          : 'text-danger text-caption border-danger inline-flex rounded-sm border px-2 py-1'
      }
    >
      {children}
    </span>
  );
}
