/* ═══════════════════════════════════════════════════
   PAWPLAN · js/ui.js
   All DOM rendering & UI interactions
════════════════════════════════════════════════════ */

const UI = (() => {

  // ── Helpers ───────────────────────────────────────

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function checkSvg() {
    return `<svg viewBox="0 0 12 10" fill="none" width="12" height="10">
      <path d="M1 5l3.5 3.5L11 1" stroke="white" stroke-width="2.2"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function badgeHtml(badge) {
    if (!badge) return '';
    const map = {
      hubstaff: ['badge-hubstaff', 'TRACKED'],
      off:      ['badge-off',      'OFF CLOCK'],
      locked:   ['badge-locked',   'LOCKED'],
    };
    const [cls, label] = map[badge] || [];
    return cls ? `<span class="item-badge ${cls}">${label}</span>` : '';
  }

  // ── Header ────────────────────────────────────────

  function renderHeader(dateStr, dayNumber) {
    const d = new Date(dateStr + 'T12:00:00');
    const dateLabel = d.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    document.getElementById('header-date').textContent = dateLabel;
    document.getElementById('day-counter').textContent = `Day ${dayNumber}`;

    const displayLabel = Schedule.formatDateDisplay(dateStr);
    const sub = `Day ${dayNumber} of 365`;

    document.getElementById('day-nav-label').textContent  = displayLabel;
    document.getElementById('day-nav-sub').textContent    = sub;
    document.getElementById('notes-day-label').textContent = displayLabel;
    document.getElementById('notes-day-sub').textContent  = sub;
  }

  // ── Schedule ──────────────────────────────────────

  function renderSchedule(dateStr, tasksMap) {
    const items = Schedule.getItems(dateStr);
    const done  = items.filter(i => tasksMap[i.id]).length;
    const total = items.length;
    const pct   = total ? Math.round((done / total) * 100) : 0;

    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-label').textContent =
      `${done} / ${total} tasks completed · ${pct}%`;

    let html = '';

    Schedule.SECTIONS.forEach(section => {
      const sectionItems = items.filter(item => section.match(item.time));
      if (!sectionItems.length) return;

      html += `<div class="schedule-section">
        <div class="section-label">${section.label}</div>`;

      sectionItems.forEach(item => {
        const completed = !!tasksMap[item.id];
        html += `
          <div class="schedule-item type-${item.type} ${completed ? 'completed' : ''}" id="item-${item.id}">
            <div class="schedule-item-inner" onclick="App.toggleTask('${item.id}')">
              <div class="item-check">${checkSvg()}</div>
              <div class="item-content">
                <div class="item-time">${escHtml(item.time)}</div>
                <div class="item-title">${escHtml(item.title)}</div>
                <div class="item-desc">${escHtml(item.desc)}</div>
                ${badgeHtml(item.badge)}
              </div>
              <div class="item-emoji">${item.emoji}</div>
            </div>
          </div>`;
      });

      html += '</div>';
    });

    document.getElementById('schedule-list').innerHTML = html;
  }

  // ── Notes (inline & tab) ──────────────────────────

  function _noteItemHtml(note, dateStr, currentUser) {
    const isOwn    = note.author === currentUser;
    const authorCls = isOwn ? '' : 'partner';
    return `
      <div class="note-item" id="note-${note.item_id}">
        <div class="note-meta">
          <span class="note-author ${authorCls}">${escHtml(note.author)}</span>
          <span class="note-time">${Schedule.formatNoteTime(note.created_at)}</span>
          <button class="note-delete" onclick="App.deleteNote('${note.item_id}')" aria-label="Delete note">✕</button>
        </div>
        <div class="note-text">${escHtml(note.content)}</div>
      </div>`;
  }

  function renderInlineNotes(notes, dateStr, currentUser) {
    const el    = document.getElementById('inline-notes-list');
    const count = document.getElementById('inline-note-count');

    count.textContent = notes.length
      ? `${notes.length} note${notes.length !== 1 ? 's' : ''}`
      : '';

    if (!notes.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">📝</div>
        No notes yet for this day
      </div>`;
      return;
    }

    el.innerHTML = notes.map(n => _noteItemHtml(n, dateStr, currentUser)).join('');
  }

  function renderNotesTab(notes, dateStr, currentUser) {
    const el = document.getElementById('notes-list');

    if (!notes.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">📝</div>
        No notes yet — write the first one!
      </div>`;
      return;
    }

    el.innerHTML = notes.map(n => `
      <div class="card" style="margin-bottom:0.75rem;">
        ${_noteItemHtml(n, dateStr, currentUser)}
      </div>`).join('');
  }

  // ── Stats ─────────────────────────────────────────

  function renderStats(allData, currentDayNumber) {
    // Aggregate
    let totalTasks = 0;
    let totalNotes = 0;
    const datesSeen = new Set();

    allData.forEach(row => {
      datesSeen.add(row.date);
      if (row.type === 'task' && row.completed) totalTasks++;
      if (row.type === 'note') totalNotes++;
    });

    // This week avg
    let weekDone = 0, weekTotal = 0;
    for (let i = 0; i < 7; i++) {
      const d  = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      weekTotal += Schedule.getItems(ds).length;
      const dayDone = allData.filter(r => r.date === ds && r.type === 'task' && r.completed).length;
      weekDone += dayDone;
    }

    // Streak: count consecutive days from today backwards where ≥50% tasks done
    const tasksByDate = {};
    allData.filter(r => r.type === 'task').forEach(r => {
      if (!tasksByDate[r.date]) tasksByDate[r.date] = [];
      tasksByDate[r.date].push(r);
    });

    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d  = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const items = Schedule.getItems(ds);
      const done  = (tasksByDate[ds] || []).filter(r => r.completed).length;
      if (done >= items.length * 0.5) {
        streak++;
      } else {
        break;
      }
    }

    document.getElementById('stat-days').textContent  = datesSeen.size;
    document.getElementById('stat-tasks').textContent = totalTasks;
    document.getElementById('stat-notes').textContent = totalNotes;
    document.getElementById('stat-week').textContent  =
      weekTotal ? Math.round((weekDone / weekTotal) * 100) + '%' : '0%';
    document.getElementById('streak-value').textContent = `${streak} Day Streak`;
    document.getElementById('week-tip').textContent = Schedule.getWeekTip(currentDayNumber);
  }

  // ── Tab switching ─────────────────────────────────

  function switchTab(tabId, btn) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');

    if (tabId === 'stats') {
      App.loadAndRenderStats();
    }
  }

  // ── Settings ──────────────────────────────────────

  function toggleSetting(el) {
    el.classList.toggle('on');
  }

  // ── Modal ─────────────────────────────────────────

  function openModal() {
    document.getElementById('note-modal').classList.add('open');
    setTimeout(() => document.getElementById('modal-note-text').focus(), 300);
  }

  function closeModal() {
    document.getElementById('note-modal').classList.remove('open');
    document.getElementById('modal-note-text').value = '';
  }

  function handleModalOverlayClick(event) {
    if (event.target === event.currentTarget) closeModal();
  }

  // ── Loading ───────────────────────────────────────

  function hideLoading() {
    const el = document.getElementById('loading');
    el.classList.add('fade-out');
    setTimeout(() => el.classList.add('hidden'), 500);
  }

  function showSetup() {
    hideLoading();
    document.getElementById('setup-screen').classList.remove('hidden');
  }

  function showApp(username) {
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('settings-name').textContent = username;
    document.getElementById('fab').classList.remove('hidden');
  }

  // ── Input helpers ─────────────────────────────────

  function getNoteInput(source) {
    const ids = {
      inline: 'inline-note-input',
      tab:    'notes-tab-input',
      modal:  'modal-note-text',
    };
    const el = document.getElementById(ids[source]);
    if (!el) return { value: '', clear: () => {} };
    return {
      value: el.value,
      clear: () => { el.value = ''; },
    };
  }

  return {
    renderHeader,
    renderSchedule,
    renderInlineNotes,
    renderNotesTab,
    renderStats,
    switchTab,
    toggleSetting,
    openModal,
    closeModal,
    handleModalOverlayClick,
    hideLoading,
    showSetup,
    showApp,
    getNoteInput,
  };

})();
