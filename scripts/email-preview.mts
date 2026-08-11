/* Renders the transactional email templates to email-preview.html so they can be eyeballed in a
   browser without sending anything. Imports the REAL functions from src/lib/notify.ts, so what you
   see is what sends: change the template, re-run this, and the preview follows.

   Run:  npm run email-preview
   (--conditions=react-server is required: src/lib/env.ts imports `server-only`, which throws on
   import outside a React Server Component unless that export condition is set.)

   Sends NO email and touches no external service. */
import { readFileSync, writeFileSync } from 'node:fs';

// env.ts is zod fail-fast, so real values must be present before anything imports it.
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { otpHtml } = await import('@/lib/notify');
const { site } = await import('@/config/site');

const OTP = '482913';
const EMAIL = 'you@example.com';
// Mirrors sendUserEmail() in src/lib/notify.ts. If that From/replyTo logic changes, change it here too.
const from = `"${site.name}" <${process.env.MAIL_FROM || process.env.GMAIL_USER}>`;
const replyTo = process.env.SUPPORT_EMAIL || process.env.MAIL_FROM || process.env.GMAIL_USER;
const subject = `Your code is ${OTP}`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// For embedding a full HTML document as an <iframe srcdoc="..."> attribute value - needs its own
// quote escaping distinct from `esc` (which targets text nodes, not attribute values).
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Mirrors the two branches of auth.ts's sendVerificationOTP - one send, two possible copies,
// depending on whether the address already has an account.
const variants = [
  { label: 'New user (first sign-in / signup)', isNewUser: true },
  { label: 'Returning user (already has an account)', isNewUser: false },
];

const blocks = variants
  .map(({ label, isNewUser }) => {
    const text = `${isNewUser ? 'Confirm your email to finish signing up' : `Sign in to ${site.name}`}: ${OTP}\n\nIf you have any questions or comments, feel free to reply to the email and our team will get in touch.\n\nThis email was sent to ${EMAIL}.`;
    // otpHtml() now returns a FULL <html><head>...</head><body>...</body></html> document (needed
    // for the <meta color-scheme> + <style>@media(prefers-color-scheme)</style> dark-mode support -
    // see its own comment in notify.ts). Nesting that directly inside this page's own <div> would
    // put two <html>/<head> pairs in one document, which browsers silently mangle. An <iframe
    // srcdoc> gives each variant its own real, isolated document - the meta tags and media query
    // apply exactly like they would for a recipient's actual mail client.
    //
    // Height is NOT fixed. A guessed fixed height either clips content or (as first shipped) shows
    // a scrollbar the real email never has - a mail client just flows the message to fill the
    // reading pane, no cropped box. `onload` measures the iframe's own rendered content and sets
    // the height to match exactly, so this preview can never show a scrollbar that isn't real.
    return `<h2 style="font-size:14px;color:#666;margin:32px 0 8px">${esc(label)}</h2>
  <div style="border:1px solid #ddd;border-radius:10px;overflow:hidden">
    <div style="background:#f6f6f4;padding:16px 20px;border-bottom:1px solid #ddd;font-size:13px;color:#444">
      <div style="margin-bottom:6px"><strong>From:</strong> ${esc(from)}</div>
      <div style="margin-bottom:6px"><strong>Reply-To:</strong> ${esc(replyTo ?? '(unset)')}</div>
      <div><strong>Subject:</strong> ${esc(subject)}</div>
    </div>
    <iframe
      srcdoc="${escAttr(otpHtml(OTP, EMAIL, isNewUser))}"
      onload="this.style.height=(this.contentDocument.documentElement.scrollHeight+4)+'px'"
      style="width:100%;height:500px;border:none;display:block;background:#fff"
    ></iframe>
    <div style="border-top:1px dashed #ddd;padding:16px 20px;background:#fafafa">
      <div style="font-size:12px;color:#888;margin-bottom:8px">Plain-text fallback</div>
      <pre style="margin:0;font-size:13px;color:#333;white-space:pre-wrap">${esc(text)}</pre>
    </div>
  </div>`;
  })
  .join('\n');

// Fake inbox chrome so the headers are visible next to the body, and the plain-text fallback
// alongside the HTML - some clients only ever show the latter.
const page = `<!doctype html><meta charset="utf-8"><title>${site.name} email previews</title>
<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 16px">
  <h1 style="font-size:18px;color:#333">${site.name} transactional email previews</h1>
  <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:14px 16px;font-size:13px;color:#3730a3;margin-bottom:24px">
    <strong>To see the dark palette below</strong> (Apple Mail / Outlook 2019+ / Samsung Mail /
    Thunderbird all honour it; Gmail's mobile apps force their own inversion regardless of this
    file - see notify.ts's own comment): either switch Windows to dark mode (Settings &rarr;
    Personalization &rarr; Colors &rarr; Choose your mode &rarr; Dark) and reload this page, or in
    Chrome/Edge open DevTools (F12) &rarr; Ctrl/Cmd+Shift+P &rarr; type "Rendering" &rarr; in the
    Rendering panel set "Emulate CSS media feature prefers-color-scheme" to "dark" - no OS change
    needed, and it flips back the same way.
  </div>
  ${blocks}
  <p style="color:#888;font-size:12px;margin-top:16px">Rendered from src/lib/notify.ts. No email was sent.</p>
</div>`;

writeFileSync('email-preview.html', page, 'utf8');
console.log(`From:     ${from}`);
console.log(`Reply-To: ${replyTo}`);
console.log(`Subject:  ${subject}`);
console.log('\nwrote email-preview.html (gitignored) - open it in a browser');
