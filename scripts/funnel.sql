-- funnel.sql — product-analytics queries against `analytics_event`.
--
-- Run via the Neon console or the neon MCP (mcp_neon_run_sql). Each query is standalone.
--
-- HOUSE RULE: an event name only appears here if it is ALSO in src/lib/analytics.ts (or a
-- server-side track() call) AND in ALLOWED_EVENTS in src/app/api/track/route.ts. All three change
-- in the same commit. A query with no event behind it reports a confident zero, which is worse
-- than no query at all — it looks like a measurement.
--
-- Counting rule: `visitor_id` for funnel steps, `COUNT(*)` for volume. A step counted by rows
-- double-counts anyone who reloaded, and a funnel that can exceed 100% is a funnel nobody trusts.

-- ── Every event, by day ──────────────────────────────────────────────────────
-- Traffic spikes and dead days.
SELECT name, DATE(created_at) AS day, COUNT(*) AS n
FROM analytics_event
GROUP BY 1, 2
ORDER BY 2 DESC, 3 DESC;

-- ── The signup funnel ────────────────────────────────────────────────────────
-- Unique visitors per step. Extend this with the product's own steps as you add events —
-- the point is the FIRST step where people stop, not the total.
SELECT
  COUNT(DISTINCT visitor_id) FILTER (WHERE name = 'login_viewed')    AS saw_login,
  COUNT(DISTINCT visitor_id) FILTER (WHERE name = 'signup_started')  AS started,
  COUNT(DISTINCT visitor_id) FILTER (WHERE name = 'signup_completed') AS signed_up
FROM analytics_event;

-- ── Where signup dies: started but never completed ───────────────────────────
-- The visitors worth understanding. If this list is long, the problem is in the auth screen,
-- not in acquisition.
SELECT visitor_id, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
FROM analytics_event
WHERE visitor_id IN (SELECT visitor_id FROM analytics_event WHERE name = 'signup_started')
  AND visitor_id NOT IN (SELECT visitor_id FROM analytics_event WHERE name = 'signup_completed')
GROUP BY 1
ORDER BY 2 DESC;

-- ── Sign-in method split ─────────────────────────────────────────────────────
-- Google vs. emailed code. A collapse in one is usually a broken provider, not a preference shift.
SELECT properties ->> 'method' AS method, COUNT(*) AS n
FROM analytics_event
WHERE name = 'signup_started'
GROUP BY 1
ORDER BY 2 DESC;

-- ── One visitor's whole session, in order ────────────────────────────────────
-- The single most useful query here. Replace the id and read what they actually did — a
-- funnel tells you where people stop, a sequence tells you why.
SELECT created_at, name, path, properties
FROM analytics_event
WHERE visitor_id = 'PASTE_VISITOR_ID'
ORDER BY created_at;

-- ── Sessions per visitor ─────────────────────────────────────────────────────
-- Return visits. `session_id` is per-tab; `visitor_id` survives tabs and reloads, so more than
-- one session per visitor means someone came back.
SELECT visitor_id, COUNT(DISTINCT session_id) AS sessions, MAX(created_at) AS last_seen
FROM analytics_event
GROUP BY 1
HAVING COUNT(DISTINCT session_id) > 1
ORDER BY 2 DESC;

-- ── Bot check ────────────────────────────────────────────────────────────────
-- Before trusting any number above. A crawler that hits /login a hundred times will quietly
-- wreck the top of the funnel.
SELECT user_agent, COUNT(*) AS n, COUNT(DISTINCT visitor_id) AS visitors
FROM analytics_event
GROUP BY 1
ORDER BY 2 DESC
LIMIT 30;

-- ── Add product queries below ────────────────────────────────────────────────
-- Anything here should answer a question you would actually change the product over.
