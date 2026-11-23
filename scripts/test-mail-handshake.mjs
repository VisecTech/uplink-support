// Mail relay handshake: connect over TLS and sign in. Sends NO mail.
// Same options as src/lib/email/transport.ts. Run with the service's env:
//   node scripts/test-mail-handshake.mjs
import { createRequire } from 'node:module';
import nodemailer from 'nodemailer';
const version = createRequire(import.meta.url)('nodemailer/package.json').version;
console.log(`nodemailer ${version}`);
const host = process.env.SMTP_HOST;
if (!host) { console.log('FAIL  SMTP_HOST is not set (the app would write mail to disk instead of sending)'); process.exit(1); }
const t = nodemailer.createTransport({
  host, port: Number(process.env.SMTP_PORT ?? 465), secure: process.env.SMTP_SECURE !== 'false',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
});
try { await t.verify(); console.log(`ok    relay accepted the sign-in (port ${process.env.SMTP_PORT ?? 465}, secure ${process.env.SMTP_SECURE !== 'false'})`); t.close(); }
catch (e) { console.log(`FAIL  ${e.code ?? ''} ${String(e.message).split('\n')[0].slice(0, 120)}`); process.exit(1); }
