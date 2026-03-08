// PawPlan · send-reminders Edge Function
// Runs every minute via pg_cron.
// Finds tasks starting in ~15 minutes and sends push notifications.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_EMAIL       = 'mailto:mattjowen1991@gmail.com';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// The fixed weekday schedule — mirrors schedule.js
// Only nova feeding / key tasks that need reminders
const REMINDER_TASKS = [
  { time: '5:00 AM',  title: "Sophie: Wake up & garden time" },
  { time: '6:00 AM',  title: "🍗 Nova's Breakfast" },
  { time: '7:00 AM',  title: 'Nova into crate (Nap 1)' },
  { time: '11:30 AM', title: "🍗 Nova's Lunch" },
  { time: '3:00 PM',  title: '🎒 Crate Nova + school run' },
  { time: '5:20 PM',  title: "🍗 Nova's Dinner" },
  { time: '9:00 AM',  title: 'Weekend garden session' },
  { time: '11:30 AM', title: "🍗 Nova's Lunch (weekend)" },
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

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Current time in UK (Europe/London)
    const now = new Date(new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }));
    const nowMins = now.getHours() * 60 + now.getMinutes();

    // Find tasks firing in 14–16 min window (cron runs every minute)
    const TARGET_MINS = 15;
    const WINDOW = 1;

    const upcoming = REMINDER_TASKS.filter(task => {
      const t = parseTime(task.time);
      if (!t) return false;
      const taskMins = t.h * 60 + t.m;
      const diff = taskMins - nowMins;
      return diff >= TARGET_MINS - WINDOW && diff <= TARGET_MINS + WINDOW;
    });

    if (upcoming.length === 0) {
      return new Response('No reminders due', { status: 200 });
    }

    // Fetch all push subscriptions
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response('No subscribers', { status: 200 });
    }

    // Send a push for each upcoming task to every subscriber
    const sends = [];
    for (const task of upcoming) {
      for (const sub of subs) {
        const payload = JSON.stringify({
          title: '🐾 PawPlan Reminder',
          body:  `${task.title} — in 15 minutes`,
          tag:   `pawplan-${task.time.replace(/\s/g, '')}`,
        });
        sends.push(
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          ).catch(e => {
            // 410 Gone = subscription expired, clean it up
            if (e.statusCode === 410) {
              supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            }
            console.warn('Push failed for', sub.endpoint, e.message);
          })
        );
      }
    }

    await Promise.all(sends);
    return new Response(`Sent ${upcoming.length} reminder(s) to ${subs.length} device(s)`, { status: 200 });

  } catch (e) {
    console.error('send-reminders error:', e);
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
});
