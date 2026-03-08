/* ═══════════════════════════════════════════════════
   PAWPLAN · js/schedule.js
   All schedule item definitions & helper functions
════════════════════════════════════════════════════ */

const Schedule = (() => {

  // ── Helpers ──────────────────────────────────────

  function isWeekend(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.getDay() === 0 || d.getDay() === 6;
  }

  function getStartDate() {
    let d = localStorage.getItem('pawplan_start_date');
    if (!d) {
      d = new Date().toISOString().split('T')[0];
      localStorage.setItem('pawplan_start_date', d);
    }
    return new Date(d + 'T12:00:00');
  }

  function getDayNumber(dateStr) {
    const start = getStartDate();
    const target = new Date(dateStr + 'T12:00:00');
    const diff = Math.floor((target - start) / 86400000) + 1;
    // Cycles every 365 days
    return ((diff - 1) % 365) + 1;
  }

  function formatDateDisplay(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const today     = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const tomorrow  = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (dateStr === today)     return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    if (dateStr === tomorrow)  return 'Tomorrow';
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function formatNoteTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      + ' · '
      + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // ── Weekly tip rotation ───────────────────────────
  const TIPS = [
    'Keep reinforcing "Leave It" around Gloria — it\'s the single most important command for a multi-pet household right now.',
    'At this age, 3–5 minute training sessions three times a day beat one long session every time. Nova\'s brain tires quickly!',
    'A tired Shepsky is a calm Shepsky. Brain games 20 minutes before your Live Chat shifts are your secret weapon.',
    'Gloria tip: dedicated 1-on-1 time in the evenings reinforces her "VIP" status and reduces tension in the house.',
    'Nova\'s prey drive is still developing. Keep rewarding the "Calm Look" — when she glances at Gloria and looks away, jackpot treat!',
    'Try a sniff walk this week. Let Nova lead with her nose for 15 minutes — it\'s more tiring than a 45-minute power walk.',
    'Practice "Wait" before every door, bowl, and garden trip. It builds impulse control which directly helps the Gloria situation.',
    'Week 8+: Start short car trips to get Nova used to travel before walks. The Lickey Hills are waiting!',
    'Rotate chew toys weekly so they stay novel and interesting — stops her targeting furniture and Gloria\'s tail.',
    'The frozen Kong is your Hubstaff hero. Prep 3 at a time and keep them in the freezer for Live Chat emergencies.',
  ];

  function getWeekTip(dayNumber) {
    return TIPS[Math.floor((dayNumber - 1) / 7) % TIPS.length];
  }

  // ── Schedule sections ─────────────────────────────
  const SECTIONS = [
    { label: '🌅 Early Morning (5–9AM)',       min: 0,     max: 9*60   },
    { label: '☀️ Morning Shift (9AM–12PM)',     min: 9*60,  max: 12*60  },
    { label: '🌤 Afternoon (12PM–3:30PM)',      min: 12*60, max: 15*60+30 },
    { label: '🌆 Late Afternoon (3:30–6PM)',    min: 15*60+30, max: 18*60 },
    { label: '🌙 Evening (6PM+)',               min: 18*60, max: 24*60+59 },
  ];

  // ── Item definitions ──────────────────────────────

  const DAILY_ALWAYS = [
    {
      id: 'sophie-wake',
      time: '5:00 AM',
      title: 'Sophie: Wake up & garden time',
      desc: 'Sophie gets up, takes Nova outside. Use Tasty Strips for quick training reps (Sit / Stay) to burn energy before breakfast.',
      emoji: '🌅',
      type: 'nova',
      who: 'sophie',
    },
    {
      id: 'breakfast',
      time: '6:00 AM',
      title: '🍗 Nova\'s Breakfast',
      desc: 'Sophie feeds Nova. Regular bowl — watch for any upset tummy signs.',
      emoji: '🍗',
      type: 'feeding',
      who: 'sophie',
    },
    {
      id: 'sophie-garden',
      time: '6:00–7:00 AM',
      title: 'Sophie: Garden play & training',
      desc: 'Post-breakfast energy burn. Tasty Strips are perfect here — small pieces, lots of reps. Sit, Stay, Touch.',
      emoji: '🌿',
      type: 'nova',
      who: 'sophie',
    },
    {
      id: 'crate-7',
      time: '7:00 AM',
      title: 'Nova into crate (Nap 1)',
      desc: 'Sophie crates Nova — forced sleep mode until 9:00 AM. Gloria\'s free-roam time begins!',
      emoji: '🏠',
      type: 'nova',
      who: 'sophie',
    },
    {
      id: 'you-up',
      time: '7:30 AM',
      title: 'You wake up + get Evie ready',
      desc: 'Morning routine. Gloria gets quiet VIP time with you — a few Dreamies goes a long way.',
      emoji: '☕',
      type: 'break',
      who: 'you',
    },
    {
      id: 'school-am',
      time: '8:30 AM',
      title: '🎒 School run (Evie)',
      desc: 'Nova stays in crate. Only 5 mins across the road — she won\'t even notice!',
      emoji: '🎒',
      type: 'school',
      who: 'you',
    },
  ];

  const WEEKDAY_WORK = [
    {
      id: 'work-start',
      time: '9:00 AM',
      title: '💻 Work starts — Backlog',
      desc: 'HUBSTAFF ON. Nova in crate or on desk tether with the Nylabone Teething Chew. She can gnaw silently for an hour — totally self-sufficient. Gloria free to audit your desk.',
      emoji: '💼',
      type: 'work',
      badge: 'hubstaff',
      who: 'you',
    },
    {
      id: 'break-1130',
      time: '11:30 AM – 12:00 PM',
      title: 'Break 1 — Lunch & garden',
      desc: 'HUBSTAFF OFF. Feed Nova her lunch bowl. 10 mins play, 10 mins garden. Goal: empty bladder & bowel BEFORE Live Chat 1.',
      emoji: '🌱',
      type: 'break',
      badge: 'off',
      who: 'you',
    },
    {
      id: 'lunch-feed',
      time: '11:30 AM',
      title: '🍗 Nova\'s Lunch',
      desc: 'Feed at the start of Break 1. Gastrocolic reflex means she\'ll need the garden — get it done now, not during Live Chat!',
      emoji: '🍗',
      type: 'feeding',
      who: 'you',
    },
    {
      id: 'livechat-1',
      time: '12:00–1:30 PM',
      title: '💬 Live Chat Shift 1 (LOCKED)',
      desc: 'HUBSTAFF ON — LOCKED. Fill the KONG with Easy Treat right before you clock in. Licking is naturally calming — it lowers her heart rate and helps her nap after. You cannot leave the desk.',
      emoji: '🔒',
      type: 'work',
      badge: 'locked',
      who: 'you',
    },
    {
      id: 'tickets',
      time: '1:30–3:00 PM',
      title: '🎫 Tickets — Office Tether',
      desc: 'HUBSTAFF ON. Nova out on desk tether. Keep Tasty Strips in your pocket — small pieces for rewarding "Quiet" during tickets. If Gloria walks past and Nova ignores her: jackpot strip!',
      emoji: '🎫',
      type: 'work',
      badge: 'hubstaff',
      who: 'you',
    },
    {
      id: 'school-pm',
      time: '3:00 PM',
      title: '🎒 Crate Nova + school run',
      desc: 'HUBSTAFF OFF. Crate Nova first — this is her reset before the final stretch. Then collect Evie. Literally 5 minutes.',
      emoji: '🎒',
      type: 'school',
      badge: 'off',
      who: 'you',
    },
    {
      id: 'livechat-2',
      time: '3:30–5:00 PM',
      title: '💬 Live Chat Shift 2 (LOCKED)',
      desc: 'HUBSTAFF ON — LOCKED. Deploy the Whimzees Puppy Chew — save these specifically for this slot. Different texture to the Nylabone = feels like a brand new activity to her brain. Witching hour sorted.',
      emoji: '🔒',
      type: 'work',
      badge: 'locked',
      who: 'you',
    },
    {
      id: 'break-5',
      time: '5:00–5:30 PM',
      title: 'Break 2 — High energy blast!',
      desc: 'HUBSTAFF OFF. Garden sprint, flirt pole, training. Burn that remaining witching-hour energy hard before the final push.',
      emoji: '🎾',
      type: 'break',
      badge: 'off',
      who: 'you',
    },
    {
      id: 'dinner-feed',
      time: '5:30 PM',
      title: '🍗 Nova\'s Dinner',
      desc: 'Final bowl feed. A full puppy is a settling puppy for the last work block.',
      emoji: '🍗',
      type: 'feeding',
      who: 'you',
    },
    {
      id: 'final-push',
      time: '5:30–6:00 PM',
      title: '💻 Final push — Settling',
      desc: 'HUBSTAFF ON. Post-dinner quiet time — Nova naturally calmer after eating. Crate or tether. Nearly there!',
      emoji: '✅',
      type: 'work',
      badge: 'hubstaff',
      who: 'you',
    },
    {
      id: 'work-end',
      time: '6:00 PM',
      title: '🎉 Work finished! Freedom time',
      desc: 'LOG OFF. Full integration — Nova, Gloria, you and the family. Big garden play, proper cuddles all round.',
      emoji: '🎉',
      type: 'break',
      who: 'both',
    },
  ];

  const WEEKEND_ITEMS = [
    {
      id: 'weekend-play',
      time: '9:00 AM',
      title: 'Weekend garden session',
      desc: 'Long garden play, scatter feeding, training games. No need to rush.',
      emoji: '🌞',
      type: 'nova',
      who: 'both',
    },
    {
      id: 'weekend-lunch',
      time: '11:30 AM',
      title: '🍗 Nova\'s Lunch (weekend)',
      desc: 'Feed then take her out for a post-meal potty trip. Stick to the routine even at weekends.',
      emoji: '🍗',
      type: 'feeding',
      who: 'both',
    },
    {
      id: 'weekend-rest',
      time: '1:00–3:00 PM',
      title: 'Afternoon crate rest',
      desc: 'Enforce a nap even on weekends — it keeps the weekday routine solid and prevents overtiredness.',
      emoji: '😴',
      type: 'nova',
      who: 'both',
    },
    {
      id: 'weekend-gloria',
      time: '2:00 PM',
      title: '😺 Gloria VIP time',
      desc: 'While Nova naps, give Gloria proper 1-on-1 attention. A confident cat = fewer hiss incidents.',
      emoji: '😺',
      type: 'break',
      who: 'both',
    },
    {
      id: 'weekend-play2',
      time: '3:30 PM',
      title: 'Afternoon adventure / training',
      desc: 'Once vaccinations done: short walk (5 min per month of age rule!) plus brain games.',
      emoji: '🐾',
      type: 'nova',
      who: 'both',
    },
    {
      id: 'weekend-dinner',
      time: '5:30 PM',
      title: '🍗 Nova\'s Dinner (weekend)',
      desc: 'Feed then garden for the post-meal poo. Good time to prep for the week ahead.',
      emoji: '🍗',
      type: 'feeding',
      who: 'both',
    },
    {
      id: 'weekend-settle',
      time: '7:30 PM',
      title: 'Evening settle routine',
      desc: 'Wind-down time: calm play only, no high-arousal games. Prep her brain for the crate.',
      emoji: '🌙',
      type: 'nova',
      who: 'both',
    },
  ];

  const BEDTIME = [
    {
      id: 'bedtime',
      time: '10:30 PM',
      title: '🌙 Bedtime routine',
      desc: 'Final garden trip — boring and business-only. Then Nova into crate: blanket over top, white noise on.',
      emoji: '🌙',
      type: 'nova',
      who: 'both',
    },
  ];

  // ── Time sorting helper ───────────────────────────

  function parseTimeToMinutes(timeStr) {
    // Handles "5:00 AM", "6:00–7:00 AM", "11:30 AM – 12:00 PM", "3:30–5:00 PM"
    // Extract the START time, but inherit AM/PM from end of string if missing
    const str = timeStr.trim();
    const ampmMatch = str.match(/(AM|PM)/gi);
    const globalAmPm = ampmMatch ? ampmMatch[ampmMatch.length - 1].toUpperCase() : null;

    // Get just the start portion (before any dash)
    const startPart = str.split(/\s*[–—-]\s*/)[0].trim();
    const m = startPart.match(/(\d+):(\d+)(?:\s*(AM|PM))?/i);
    if (!m) return 0;

    let h = parseInt(m[1]), min = parseInt(m[2]);
    const ampm = (m[3] || globalAmPm || 'AM').toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }

  function sortByTime(items) {
    return [...items].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  }

  // ── Public API ─────────────────────────────────────

  function getItems(dateStr) {
    const weekend = isWeekend(dateStr);
    return [
      ...DAILY_ALWAYS,
      ...(weekend ? WEEKEND_ITEMS : WEEKDAY_WORK),
      ...BEDTIME,
    ];
  }

  // Returns items merged with custom/override tasks, sorted by time
  function getMergedItems(dateStr, customTasks) {
    const base = getItems(dateStr);
    const overrideIds = new Set(customTasks.filter(t => t._override).map(t => t.id));

    // Remove built-in items that have been overridden
    const filtered = base.filter(item => !overrideIds.has(item.id));

    // Add custom + override tasks
    const merged = [...filtered, ...customTasks];
    return sortByTime(merged);
  }

  return {
    getItems,
    getMergedItems,
    sortByTime,
    parseTimeToMinutes,
    getDayNumber,
    formatDateDisplay,
    formatNoteTime,
    getWeekTip,
    SECTIONS,
    isWeekend,
  };

})();
