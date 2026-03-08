/* ═══════════════════════════════════════════════════
   PAWPLAN · js/app.js
   Main controller — state, setup, actions
════════════════════════════════════════════════════ */

const App = (() => {

  // ── State ─────────────────────────────────────────
  let dayOffset        = 0;
  let tasksCache       = {};   // { dateStr: { itemId: bool } }
  let notesCache       = {};   // { dateStr: [ ...noteRows ] }
  let customTasksCache = {};   // { dateStr: [ ...taskObjs ] }

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
      // Don't delete config — network might just be slow or offline
      // Show setup so user can re-enter if they want, but keep stored config
      alert(`Couldn't connect to Supabase.\n\n${message}\n\nCheck your connection and try again.`);
      UI.showSetup();
      // Pre-fill the fields so they don't have to retype everything
      const uEl = document.getElementById('setup-username');
      const urlEl = document.getElementById('setup-url');
      const keyEl = document.getElementById('setup-key');
      if (uEl) uEl.value = cfg.username;
      if (urlEl) urlEl.value = cfg.url;
      if (keyEl) keyEl.value = cfg.key;
      return;
    }

    UI.showApp(cfg.username);
    await _loadAndRender(getDateStr());
    UI.hideLoading();
  }

  async function init() {
    // Push a base history entry so the back gesture never hits the bottom
    // of the stack and closes the PWA. The popstate handler in ui.js catches
    // any subsequent back gestures and closes modals instead.
    if (!history.state || !history.state.base) {
      history.replaceState({ base: true }, '');
    }

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
    if (!tasksCache[dateStr]) {
      const { tasks, notes } = await DB.loadDay(dateStr);
      tasksCache[dateStr] = tasks;
      notesCache[dateStr] = notes;
    }
    if (!customTasksCache[dateStr]) {
      customTasksCache[dateStr] = await DB.loadCustomTasks(dateStr);
    }

    const dayNumber = Schedule.getDayNumber(dateStr);
    UI.renderHeader(dateStr, dayNumber);
    UI.renderSchedule(dateStr, tasksCache[dateStr], customTasksCache[dateStr]);
    UI.renderInlineNotes(notesCache[dateStr] || [], dateStr, DB.getUsername());
    UI.renderNotesTab(notesCache[dateStr] || [], dateStr, DB.getUsername());

    // Pre-render adjacent panels (fire-and-forget, no await)
    _renderAdjacentPanel('prev', dateStr, -1);
    _renderAdjacentPanel('next', dateStr, +1);
  }

  function _offsetDate(dateStr, delta) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    return d.toISOString().split('T')[0];
  }

  async function _renderAdjacentPanel(which, currentDateStr, delta) {
    const panelEl = document.getElementById(`panel-${which}`);
    if (!panelEl) return;

    const adjDate = _offsetDate(currentDateStr, delta);

    // Render immediately with whatever we have (static schedule, no completion state yet)
    // This means the panel is visible right away when the user starts swiping
    panelEl.innerHTML = UI.buildScheduleHtml(
      adjDate,
      tasksCache[adjDate] || {},
      customTasksCache[adjDate] || []
    );

    // Then load from DB in the background and patch if anything changed
    const needsTasks  = !tasksCache[adjDate];
    const needsCustom = !customTasksCache[adjDate];

    if (needsTasks) {
      const { tasks, notes } = await DB.loadDay(adjDate);
      tasksCache[adjDate]  = tasks;
      notesCache[adjDate]  = notes;
    }
    if (needsCustom) {
      customTasksCache[adjDate] = await DB.loadCustomTasks(adjDate);
    }

    // Only re-render if we actually fetched new data (avoids flicker if cached)
    if (needsTasks || needsCustom) {
      // Check panel is still the right one (user might have swiped again)
      if (document.getElementById(`panel-${which}`) === panelEl) {
        panelEl.innerHTML = UI.buildScheduleHtml(
          adjDate,
          tasksCache[adjDate],
          customTasksCache[adjDate]
        );
      }
    }
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

    UI.haptic(newValue ? 'success' : 'light');

    // Optimistic update
    if (!tasksCache[dateStr]) tasksCache[dateStr] = {};
    tasksCache[dateStr][itemId] = newValue;
    UI.renderSchedule(dateStr, tasksCache[dateStr], customTasksCache[dateStr] || []);

    // Persist to DB
    DB.toggleTask(dateStr, itemId, newValue);
  }

  // ── Task editor ───────────────────────────────────

  function openTaskEditor(itemId) {
    try {
      const dateStr = getDateStr();
      const custom  = customTasksCache[dateStr] || [];
      let task = custom.find(t => t.id === itemId);
      if (!task) {
        const base = Schedule.getItems(dateStr);
        const base_item = base.find(i => i.id === itemId);
        if (base_item) task = { ...base_item, _override: false, _isNew: false };
      }
      UI.openTaskEditor(task || { id: itemId, _new: true });
    } catch(e) {
      alert('openTaskEditor error: ' + e.message);
    }
  }

  function openNewTaskEditor() {
    try {
      UI.openTaskEditor({ _new: true, id: `custom_${Date.now()}`, _isNew: true });
    } catch(e) {
      alert('openNewTaskEditor error: ' + e.message);
    }
  }

  async function saveTaskEdit() {
    const dateStr = getDateStr();
    const id      = document.getElementById('task-editor-id').value || `custom_${Date.now()}`;

    // Build time string from spinners
    const time  = UI.getTimeFromSpinners();

    const title = document.getElementById('task-editor-label').value.trim();
    const desc  = document.getElementById('task-editor-desc').value.trim();
    const type  = document.getElementById('task-editor-type').value;

    if (!title) {
      alert('Please enter a task title.');
      return;
    }

    // Is this a built-in being overridden or a new custom task?
    const baseItems = Schedule.getItems(dateStr);
    const isBuiltIn = baseItems.some(i => i.id === id);

    const task = {
      id,
      time,
      title,
      desc,
      emoji: '📌',
      type,
      badge: null,
      _isNew: !isBuiltIn,
      _override: isBuiltIn,
    };

    UI.closeTaskEditor();

    // Optimistic update cache
    if (!customTasksCache[dateStr]) customTasksCache[dateStr] = [];
    const idx = customTasksCache[dateStr].findIndex(t => t.id === id);
    if (idx >= 0) customTasksCache[dateStr][idx] = task;
    else customTasksCache[dateStr].push(task);

    UI.renderSchedule(dateStr, tasksCache[dateStr] || {}, customTasksCache[dateStr]);

    await DB.saveCustomTask(dateStr, task);
  }

  async function deleteCustomTask(itemId) {
    const dateStr = getDateStr();
    if (!confirm('Remove this task?')) return;

    // Optimistic remove
    customTasksCache[dateStr] = (customTasksCache[dateStr] || []).filter(t => t.id !== itemId);
    UI.renderSchedule(dateStr, tasksCache[dateStr] || {}, customTasksCache[dateStr]);

    await DB.deleteCustomTask(dateStr, itemId);
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

  return {
    init,
    saveSetup,
    resetApp,
    changeDay,
    toggleTask,
    addNote,
    deleteNote,
    loadAndRenderStats,
    openTaskEditor,
    openNewTaskEditor,
    saveTaskEdit,
    deleteCustomTask,
  };

})();

// ── Kick everything off ───────────────────────────
document.addEventListener('DOMContentLoaded', App.init);

// ── Offline detection ─────────────────────────────
window.addEventListener('online',  () => document.getElementById('offline-banner').classList.remove('show'));
window.addEventListener('offline', () => document.getElementById('offline-banner').classList.add('show'));
if (!navigator.onLine) document.getElementById('offline-banner').classList.add('show');
