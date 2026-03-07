# 🐾 PawPlan — Nova & Gloria's Daily Schedule App

A mobile-first progressive web app for tracking Nova's daily routine alongside work and Gloria the cat.
Built as a static site hosted on **GitHub Pages**, backed by **Supabase** for real-time shared data.

---

## Project Structure

```
pawplan-app/
├── index.html          ← App shell & HTML structure
├── css/
│   └── styles.css      ← All styling (mobile-first)
├── js/
│   ├── schedule.js     ← Schedule item definitions & helpers
│   ├── db.js           ← Supabase database layer
│   ├── ui.js           ← All DOM rendering
│   └── app.js          ← Main controller & state
└── README.md
```

---

## 1. Create Your Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Give it a name (e.g. `pawplan`), pick a region close to the UK, set a database password
3. Wait ~2 minutes for it to spin up
4. Go to **Settings → API** and copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public key** — starts with `eyJhbGci...`

---

## 2. Create the Database Table

In your Supabase project, go to **SQL Editor** and run this:

```sql
-- Create the main data table
CREATE TABLE IF NOT EXISTS pawplan_data (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date        date NOT NULL,
  type        text NOT NULL CHECK (type IN ('task', 'note')),
  item_id     text NOT NULL,
  content     text DEFAULT '',
  author      text DEFAULT '',
  completed   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Add an index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_pawplan_date ON pawplan_data(date);

-- Enable Row Level Security
ALTER TABLE pawplan_data ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (both you and your partner share the same anon key)
CREATE POLICY "Allow all authenticated" ON pawplan_data
  FOR ALL USING (true) WITH CHECK (true);
```

---

## 3. GitHub Repo Setup (iTerm)

Run these commands in iTerm one by one:

```bash
# 1. Navigate to your Projects folder
cd /Users/mattowen/Projects

# 2. Clone the repo (do this after creating it on GitHub first)
#    Go to github.com → New Repository → name it "pawplan-app" → Create
#    Then clone it:
git clone https://github.com/mattjowen1991-hue/pawplan-app.git

# 3. Move into the project folder
cd pawplan-app

# 4. Copy your app files into it (if you built them elsewhere)
#    Or just create files directly in this folder

# 5. Stage everything
git add .

# 6. First commit
git commit -m "feat: initial PawPlan app"

# 7. Push to GitHub
git push origin main
```

---

## 4. Enable GitHub Pages

1. Go to your repo on GitHub: `github.com/mattjowen1991-hue/pawplan-app`
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Branch: `main` · Folder: `/ (root)` → **Save**
5. Wait ~2 minutes, then your app is live at:
   ```
   https://mattjowen1991-hue.github.io/pawplan-app/
   ```

---

## 5. Your Daily Git Workflow (iTerm)

Whenever you make changes to the app:

```bash
# Navigate to project
cd /Users/mattowen/Projects/pawplan-app

# Check what's changed
git status

# Stage your changes
git add .

# Commit with a message
git commit -m "fix: update schedule timing"

# Push — GitHub Pages auto-deploys within ~60 seconds
git push origin main
```

---

## 6. Sharing with Your Partner

Send your partner the live URL:
```
https://mattjowen1991-hue.github.io/pawplan-app/
```

They open it in their phone browser, tap **Add to Home Screen** for an app-like experience, then enter:
- Their own **name** (e.g. "Sarah")
- The **same** Supabase URL and Anon Key as you

Their tasks and notes will sync in real-time. Their name appears in a different colour on notes.

---

## 7. Add to Home Screen (iPhone)

1. Open the URL in **Safari**
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Name it **PawPlan** → **Add**

Now it behaves like a native app with no browser chrome.

---

## Tips

- **Supabase free tier** is more than enough — 500MB storage, unlimited API calls
- Changes you push to `main` go live automatically via GitHub Pages within ~1 minute
- The schedule resets every 365 days automatically — no manual work needed
- Weekend days automatically show a different (relaxed) schedule
- Gloria's cat tips are built into the schedule items 🐱
