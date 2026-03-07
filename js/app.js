/* ═══════════════════════════════════════════════════
   PAWPLAN · js/app.js
   Main controller — state, setup, actions
════════════════════════════════════════════════════ */

const App = (() => {

  // ── State ─────────────────────────────────────────
  let dayOffset  = 0;       // 0 = today, -1 = yesterday, etc.
  let tasksCache = {};      // { dateStr: { itemId: bool } }
  let notesCache = {};      // { dateStr: [ ...noteRows ] }

  // ── Date helpers ──────────────────────────────────

  function getDateStr(offset = dayOffset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  }

  // ── Setup ─────────────────────────────────────────

  function saveSetup() {
    const username = document.getElementById('setup-username').value.trim();
    const url      = document.getElementById('setup-url').value.trim();
    const key      = document.getElementById('setup-key').value.trim();

    if (!username || !url || !key) {
      alert('Please fill in all three fields.');
      return;
    }

    const cfg = { username, url, key };
    localStorage.setItem('pawplan_config', JSON.stringify(cfg));
    _boot(cfg);
  }

  function resetApp() {
    if (confirm('Reset local settings? Your Supabase data is kept safe.')) {
      localStorage.removeItem('pawplan_config');
      location.reload();
    }
  }

  // ── Boot sequence ─────────────────────────────────

  async function _boot(cfg) {
    DB.init(cfg.url, cfg.key, cfg.username);

    const { ok, message } = await DB.testConnection();
    if (!ok) {
      alert(`Couldn't connect to Supabase.\n\n${message}\n\nCheck your URL and Anon Key.`);
      UI.showSetup();
      return;
    }

    UI.showApp(cfg.username);

    // Load today
    await _loadAndRender(getDateStr());

    UI.hideLoading();
  }

  async function init() {
    const stored = localStorage.getItem('pawplan_config');
    if (stored) {
      try {
        await _boot(JSON.parse(stored));
      } catch (e) {
        console.error('[App] boot error', e);
        UI.showSetup();
      }
    } else {
      UI.showSetup();
    }
  }

  // ── Load & render for a date ──────────────────────

  async function _loadAndRender(dateStr) {
    // Only fetch from DB if not already cached
    if (!tasksCache[dateStr]) {
      const { tasks, notes } = await DB.loadDay(dateStr);
      tasksCache[dateStr] = tasks;
      notesCache[dateStr] = notes;
    }

    const dayNumber = Schedule.getDayNumber(dateStr);

    UI.renderHeader(dateStr, dayNumber);
    UI.renderSchedule(dateStr, tasksCache[dateStr]);
    UI.renderInlineNotes(notesCache[dateStr] || [], dateStr, DB.getUsername());
    UI.renderNotesTab(notesCache[dateStr] || [], dateStr, DB.getUsername());
  }

  // ── Day navigation ────────────────────────────────

  async function changeDay(dir) {
    dayOffset += dir;
    const dateStr = getDateStr();
    await _loadAndRender(dateStr);
  }

  // ── Task toggle ───────────────────────────────────

  async function toggleTask(itemId) {
    const dateStr  = getDateStr();
    const current  = !!(tasksCache[dateStr] && tasksCache[dateStr][itemId]);
    const newValue = !current;

    // Optimistic update
    if (!tasksCache[dateStr]) tasksCache[dateStr] = {};
    tasksCache[dateStr][itemId] = newValue;
    UI.renderSchedule(dateStr, tasksCache[dateStr]);

    // Persist to DB (fire and forget)
    DB.toggleTask(dateStr, itemId, newValue);
  }

  // ── Notes ─────────────────────────────────────────

  async function addNote(source) {
    const input = UI.getNoteInput(source);
    const text  = input.value.trim();
    if (!text) return;

    const dateStr = getDateStr();
    input.clear();

    // Close modal if from modal
    if (source === 'modal') UI.closeModal();

    // Optimistic update
    const note = await DB.addNote(dateStr, text);
    if (note) {
      if (!notesCache[dateStr]) notesCache[dateStr] = [];
      notesCache[dateStr].unshift(note);
      UI.renderInlineNotes(notesCache[dateStr], dateStr, DB.getUsername());
      UI.renderNotesTab(notesCache[dateStr], dateStr, DB.getUsername());
    }
  }

  async function deleteNote(itemId) {
    const dateStr = getDateStr();

    // Optimistic remove
    notesCache[dateStr] = (notesCache[dateStr] || []).filter(n => n.item_id !== itemId);
    UI.renderInlineNotes(notesCache[dateStr], dateStr, DB.getUsername());
    UI.renderNotesTab(notesCache[dateStr], dateStr, DB.getUsername());

    DB.deleteNote(itemId);
  }

  // ── Stats ─────────────────────────────────────────

  async function loadAndRenderStats() {
    const allData   = await DB.loadAllStats();
    const dayNumber = Schedule.getDayNumber(getDateStr());
    UI.renderStats(allData, dayNumber);
  }

  // ── Public API ────────────────────────────────────
  return {
    init,
    saveSetup,
    resetApp,
    changeDay,
    toggleTask,
    addNote,
    deleteNote,
    loadAndRenderStats,
  };

})();

// ── Kick everything off ───────────────────────────
document.addEventListener('DOMContentLoaded', App.init);

// ── Offline detection ─────────────────────────────
window.addEventListener('online',  () => document.getElementById('offline-banner').classList.remove('show'));
window.addEventListener('offline', () => document.getElementById('offline-banner').classList.add('show'));
if (!navigator.onLine) document.getElementById('offline-banner').classList.add('show');
