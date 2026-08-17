/* The import progress protocol, shared by the route that emits it and the UI that renders it.
 * One file, so a field rename cannot silently desync the two halves.
 *
 * Ported from `run-trading@v2` (2026-08-15, S4e), with the failure event widened — see below.
 *
 * NDJSON (one JSON object per line) rather than SSE: there is no reconnection or event-type routing
 * to justify SSE's framing, and NDJSON is trivial to read from a fetch reader.
 *
 * WHY STREAM AT ALL. The import is the longest wait in the product, and a single spinner over it
 * reads as a hang. Streaming lets the panel show what actually finished, with real counts, as it
 * finishes. The alternative was a fixed step list on a timer, which is theatre and desyncs the
 * moment a connection is slow.
 *
 * NO `payload` OR `raw` CROSSES THIS BOUNDARY. Everything here is counts and codes. The event log's
 * jsonb is server-side detail and the client has no business holding a copy of it.
 */
import type { PreflightFinding } from './preflight';

/** Emitted once per file TYPE, in the order the server ingested them (fills first) — files of the
 *  same type are parsed into one aggregate array before reporting, so two Fills exports staged
 *  together produce a single event covering both, not two. */
export interface ImportFileEvent {
  type: 'file';
  fileType: string;
  /** Rows the database accepted. 0 on a re-import, which is correct, not a failure. */
  imported: number;
  parsed: number;
  accounts: string[];
}

/** Terminal success. Totals are authoritative; do not sum the file events client-side. */
export interface ImportDoneEvent {
  type: 'done';
  imported: number;
  parsed: number;
  /** Account names seen across the batch. More than one means a copy-trader. */
  accounts: string[];
  /** Files whose header matched no known export. Named, never silently dropped. */
  skipped: string[];
  /** Non-blocking findings that still have to reach the trader — `pnl_unreconciled` and
   *  `statement_uncovered` both pass the import and both mean a number is worth a second look. */
  warnings: PreflightFinding[];
}

/**
 * Terminal failure AFTER the response committed to 200. Auth and validation still fail normally
 * with a JSON status before the stream opens; this covers what can only go wrong mid-ingest.
 *
 * IT CARRIES THE FINDINGS, WHICH IS THE DEPARTURE FROM v2. That build threw `new Error(message)`
 * and sent the string — which welds a check to its copy: a screen cannot re-word it, a test
 * asserting on prose breaks when the prose improves, and there is nowhere to put the counts a good
 * message needs. This build's preflight returns a code plus its numbers for exactly that reason,
 * and with no confirm panel in the flow (Luke, 2026-08-15) this event is the ONLY surface those
 * thirteen codes ever reach. Losing them to a string here would make the whole structured-findings
 * design pointless at the one moment it matters.
 *
 * `message` stays as the fallback for a genuine exception, which has no code.
 */
export interface ImportErrorEvent {
  type: 'error';
  message: string;
  findings?: PreflightFinding[];
}

export type ImportEvent = ImportFileEvent | ImportDoneEvent | ImportErrorEvent;

export const IMPORT_STREAM_CONTENT_TYPE = 'application/x-ndjson';

/**
 * Read an NDJSON body, yielding each event.
 *
 * Buffers partial lines: a chunk boundary can land mid-object, and parsing per-chunk instead of
 * per-line would throw on perfectly valid output.
 */
export async function* readImportStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<ImportEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line) as ImportEvent;
      }
    }
    // A final line with no trailing newline. Should not happen, but dropping a `done` event over a
    // missing byte would hang the UI forever.
    const tail = buffer.trim();
    if (tail) yield JSON.parse(tail) as ImportEvent;
  } finally {
    reader.releaseLock();
  }
}
