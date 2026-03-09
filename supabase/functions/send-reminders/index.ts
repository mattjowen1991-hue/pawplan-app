// PawPlan · send-reminders Edge Function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY      = Deno.env.get('SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_EMAIL       = 'mailto:mattjowen1991@gmail.com';

const REMINDER_TASKS = [
  { time: '5:00 AM',  title: "Sophie: Wake up & garden time" },
  { time: '6:00 AM',  title: "Nova's Breakfast" },
  { time: '7:00 AM',  title: 'Nova into crate (Nap 1)' },
  { time: '11:30 AM', title: "Nova's Lunch" },
  { time: '3:00 PM',  title: 'Crate Nova + school run' },
  { time: '5:20 PM',  title: "Nova's Dinner" },
  { time: '9:00 AM',  title: 'Weekend garden session' },
  { time: '11:30 AM', title: "Nova's Lunch (weekend)" },
];

function parseTime(timeStr: string): { h: number; m: number } | null {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { h, m };
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function buildVapidJwt(audience: string): Promise<string> {
  const headerB64 = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  );
  const now = Math.floor(Date.now() / 1000);
  const payloadB64 = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: VAPID_EMAIL }))
  );
  const signingInput = `${headerB64}.${payloadB64}`;

  const rawKey = base64urlToUint8Array(VAPID_PRIVATE_KEY);
  const pkcs8 = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
    ...rawKey,
  ]);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', pkcs8.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  ));

  return `${signingInput}.${uint8ArrayToBase64url(sig)}`;
}

async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payloadStr: string
): Promise<void> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience);

  const recipientPublicKeyBytes = base64urlToUint8Array(sub.p256dh);
  const authSecret = base64urlToUint8Array(sub.auth);

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const serverPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  );
  const recipientPublicKey = await crypto.subtle.importKey(
    'raw', recipientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPublicKey },
    serverKeyPair.privateKey as CryptoKey, 256
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const sharedSecretKey = await crypto.subtle.importKey(
    'raw', sharedSecret, 'HKDF', false, ['deriveBits']
  );
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const prk = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: authInfo },
    sharedSecretKey, 256
  );
  const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);

  const context = new Uint8Array(135);
  const dv = new DataView(context.buffer);
  new TextEncoder().encodeInto('P-256\0', context);
  dv.setUint16(6, 65, false);
  context.set(recipientPublicKeyBytes, 8);
  dv.setUint16(73, 65, false);
  context.set(serverPublicRaw, 75);

  const cekInfo   = new Uint8Array([...new TextEncoder().encode('Content-Encoding: aesgcm\0'), ...context]);
  const nonceInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: nonce\0'),  ...context]);

  const cekBits   = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo   }, prkKey, 128);
  const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkKey, 96);

  const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);
  const plaintext = new Uint8Array([0, 0, ...new TextEncoder().encode(payloadStr)]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBits }, cek, plaintext
  ));

  const body = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.byteLength);
  let off = 0;
  body.set(salt, off); off += 16;
  new DataView(body.buffer).setUint32(off, 4096, false); off += 4;
  body[off++] = 65;
  body.set(serverPublicRaw, off); off += 65;
  body.set(ciphertext, off);

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption': `salt=${uint8ArrayToBase64url(salt)}`,
      'Crypto-Key': `dh=${uint8ArrayToBase64url(serverPublicRaw)};p256ecdsa=${VAPID_PUBLIC_KEY}`,
      'TTL': '86400',
    },
    body,
  });

  if (res.status !== 200 && res.status !== 201) {
    const txt = await res.text();
    throw new Error(`FCM ${res.status}: ${txt}`);
  }
}

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const now = new Date(new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }));
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const upcoming = REMINDER_TASKS.filter(task => {
      const t = parseTime(task.time);
      if (!t) return false;
      const diff = (t.h * 60 + t.m) - nowMins;
      return diff >= 14 && diff <= 16;
    });

    if (upcoming.length === 0) return new Response('No reminders due', { status: 200 });

    const { data: subs, error } = await supabase.from('push_subscriptions').select('*');
    if (error) throw error;
    if (!subs?.length) return new Response('No subscribers', { status: 200 });

    const results: string[] = [];
    for (const task of upcoming) {
      for (const sub of subs) {
        try {
          await sendPush(sub, JSON.stringify({
            title: 'PawPlan Reminder',
            body: `${task.title} in 15 minutes`,
            tag: `pawplan-${task.time.replace(/\s/g, '')}`,
          }));
          results.push(`sent to ...${sub.endpoint.slice(-20)}`);
        } catch (e) {
          if (e.message.includes('410') || e.message.includes('404')) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            results.push(`removed expired sub`);
          } else {
            results.push(`error: ${e.message}`);
          }
        }
      }
    }

    return new Response(results.join('\n'), { status: 200 });
  } catch (e) {
    console.error('send-reminders error:', e);
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
});
