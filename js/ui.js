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

  function buildScheduleHtml(dateStr, tasksMap, customTasks) {
    const custom = customTasks || [];
    const items  = Schedule.getMergedItems(dateStr, custom);
    let html = '';

    Schedule.SECTIONS.forEach(section => {
      const sectionItems = items.filter(item => {
        const mins = Schedule.parseTimeToMinutes(item.time);
        return mins >= section.min && mins < section.max;
      });
      if (!sectionItems.length) return;

      html += `<div class="schedule-section">
        <div class="section-label">${section.label}</div>`;

      sectionItems.forEach(item => {
        const completed = !!(tasksMap && tasksMap[item.id]);
        const typeColours = {
          work: 'var(--forest)', nova: 'var(--terracotta)',
          feeding: 'var(--gold)', break: 'var(--forest-light)', school: 'var(--lavender)'
        };
        const colour = typeColours[item.type] || 'var(--sand-dark)';
        html += `
          <div class="schedule-item type-${item.type} ${completed ? 'completed' : ''}"
               id="item-${item.id}" data-id="${item.id}" style="--task-colour:${colour}">
            <div class="schedule-item-inner" onclick="App.toggleTask('${item.id}')">
              <div class="item-check">${checkSvg()}</div>
              <div class="item-content">
                <div class="item-time">${escHtml(item.time)}</div>
                <div class="item-title">${escHtml(item.title)}</div>
                <div class="item-desc">${escHtml(item.desc || '')}</div>
                ${badgeHtml(item.badge)}
              </div>
              <div class="item-emoji">${item.emoji || '📌'}</div>
            </div>
            <div class="long-press-bar"><div class="long-press-bar-fill"></div></div>
          </div>`;
      });

      html += '</div>';
    });

    return html;
  }

  function renderSchedule(dateStr, tasksMap, customTasks) {
    const custom = customTasks || [];
    const items  = Schedule.getMergedItems(dateStr, custom);
    const done   = items.filter(i => tasksMap[i.id]).length;
    const total  = items.length;
    const pct    = total ? Math.round((done / total) * 100) : 0;

    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-label').textContent =
      `${done} / ${total} tasks completed · ${pct}%`;

    document.getElementById('schedule-list').innerHTML = buildScheduleHtml(dateStr, tasksMap, customTasks);
    _fitWrapToCurrentPanel();
  }

  // Clamp the carousel wrap height to the current panel so adjacent
  // taller panels don't create dead space below the last task card.
  function _fitWrapToCurrentPanel() {
    const wrap    = document.getElementById('schedule-slide-wrap');
    const current = document.getElementById('panel-current');
    if (!wrap || !current) return;
    // Let it reflow first, then snapshot the height
    requestAnimationFrame(() => {
      wrap.style.height = current.offsetHeight + 'px';
    });
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
    if (!el) return;  // inline notes panel removed — silently skip

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

    // Carousel and schedule header only show on Today tab
    const carousel = document.getElementById('schedule-slide-wrap');
    const scheduleContent = document.querySelector('.content-schedule');
    const tabsContent = document.querySelector('.content-tabs');

    const isSchedule = tabId === 'schedule';
    if (carousel)        carousel.style.display       = isSchedule ? '' : 'none';
    if (scheduleContent) scheduleContent.style.display = isSchedule ? '' : 'none';
    if (tabsContent)     tabsContent.style.display     = isSchedule ? 'none' : '';

    if (tabId === 'stats') App.loadAndRenderStats();
  }

  // ── Settings ──────────────────────────────────────

  function toggleSetting(el) {
    el.classList.toggle('on');
  }

  // ── Task editor modal ─────────────────────────────

  function setTimeSpinners(timeStr) {
    const tm = timeStr && timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    document.getElementById('task-time-hour').value = tm ? String(parseInt(tm[1])) : '9';
    document.getElementById('task-time-min').value  = tm ? tm[2].padStart(2,'0')  : '00';
    document.getElementById('task-time-ampm').value = tm ? tm[3].toUpperCase()    : 'AM';
  }

  function getTimeFromSpinners() {
    const h    = document.getElementById('task-time-hour').value;
    const m    = document.getElementById('task-time-min').value;
    const ampm = document.getElementById('task-time-ampm').value;
    return `${h}:${m} ${ampm}`;
  }

  // ── Android back gesture handler ─────────────────
  // Push a history entry when any modal opens so the back gesture
  // closes the modal instead of exiting the PWA
  function pushModalHistory() {
    history.pushState({ modal: true }, '');
  }

  function handlePopState(e) {
    const taskModal = document.getElementById('task-editor-modal');
    const noteModal = document.getElementById('note-modal');
    if (taskModal && taskModal.classList.contains('open')) {
      closeTaskEditor();
      // Re-push base so back never bottoms out the stack
      history.replaceState({ base: true }, '');
    } else if (noteModal && noteModal.classList.contains('open')) {
      closeModal();
      history.replaceState({ base: true }, '');
    }
  }

  window.addEventListener('popstate', handlePopState);

  function openTaskEditor(task) {
    const modal = document.getElementById('task-editor-modal');
    const isNew = !task || task._new;

    document.getElementById('task-editor-title').textContent = isNew ? 'Add Task' : 'Edit Task';
    document.getElementById('task-editor-label').value = task ? task.title : '';
    document.getElementById('task-editor-desc').value  = task ? (task.desc || '') : '';
    document.getElementById('task-editor-id').value    = task ? task.id    : '';

    setTimeSpinners(task ? task.time : '9:00 AM');

    const typeSelect = document.getElementById('task-editor-type');
    typeSelect.value = task ? (task.type || 'nova') : 'nova';

    const deleteBtn = document.getElementById('task-editor-delete');
    if (deleteBtn) deleteBtn.style.display = (task && (task._isNew || task._override)) ? 'block' : 'none';

    document.body.classList.add('modal-open');
    modal.classList.add('open');
    pushModalHistory();
  }

  function closeTaskEditor() {
    document.getElementById('task-editor-modal').classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  function handleTaskEditorOverlay(event) {
    if (event.target === event.currentTarget) {
      history.back(); // triggers popstate → closeTaskEditor
    }
  }

  // ── Modal ─────────────────────────────────────────

  function openModal() {
    const m = document.getElementById('note-modal');
    if (!m) return;
    m.classList.add('open');
    document.body.classList.add('modal-open');
    pushModalHistory();
    setTimeout(() => document.getElementById('modal-note-text').focus(), 300);
  }

  function closeModal() {
    const m = document.getElementById('note-modal');
    if (!m) return;
    m.classList.remove('open');
    document.body.classList.remove('modal-open');
    const t = document.getElementById('modal-note-text');
    if (t) t.value = '';
  }

  function handleModalOverlayClick(event) {
    if (event.target === event.currentTarget) {
      history.back(); // triggers popstate → closeModal
    }
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
    document.getElementById('app').classList.add('hidden');
    const fabGroup = document.getElementById('fab-group');
    if (fabGroup) fabGroup.classList.add('hidden');
  }

  function showApp(username) {
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('settings-name').textContent = username;
    const fabGroup = document.getElementById('fab-group');
    if (fabGroup) fabGroup.classList.remove('hidden');
    const fab = document.getElementById('fab');
    if (fab) fab.classList.remove('hidden');
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

  // ── Haptics ───────────────────────────────────────
  function haptic(type = 'light') {
    if (!navigator.vibrate) return;
    const patterns = { light: [10], medium: [20], heavy: [30], success: [10, 50, 10] };
    navigator.vibrate(patterns[type] || [10]);
  }

  // ── Three-panel carousel swipe ────────────────────
  // Three panels [prev=0][current=1][next=2] in a 300%-wide track.
  // Panel width = 1/3 of track = 100% of viewport wrap.
  // To show panel at index i: translateX(-i * 33.333%)
  // So "current" (index 1) sits at translateX(-33.333%)

  function initSwipe() {
    const wrap = document.getElementById('schedule-slide-wrap');
    if (!wrap) return;

    let startX = 0, startY = 0, startTime = 0;
    let dragging = false, locked = false;

    // pos is the extra pixel offset from the resting centre position
    function setTrackPos(extraPx, animated) {
      const track = document.getElementById('carousel-track');
      if (!track) return;
      track.style.transition = animated
        ? 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)'
        : 'none';
      // -33.333% centres on panel 1 (current); extraPx is drag offset
      track.style.transform = `translateX(calc(-33.333% + ${extraPx}px))`;
    }

    wrap.addEventListener('touchstart', e => {
      if (document.querySelector('.modal-overlay.open')) return;
      if (e.target.closest('select,input,textarea,button')) return;
      startX    = e.touches[0].clientX;
      startY    = e.touches[0].clientY;
      startTime = Date.now();
      dragging  = true;
      locked    = false;
      setTrackPos(0, false);
    }, { passive: true });

    wrap.addEventListener('touchmove', e => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!locked) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }

      if (locked === 'h') {
        setTrackPos(dx * 0.92, false);
      }
    }, { passive: true });

    wrap.addEventListener('touchend', e => {
      if (!dragging) return;
      dragging = false;
      if (locked !== 'h') return;

      const dx      = e.changedTouches[0].clientX - startX;
      const elapsed = Date.now() - startTime;
      const isSwipe = Math.abs(dx) > 50 && elapsed < 400;

      if (isSwipe) {
        // dx < 0 = swipe left = next day (+1); dx > 0 = swipe right = prev day (-1)
        const dir = dx < 0 ? 1 : -1;
        // Snap to adjacent panel: offset by one panel width = wrap.clientWidth
        setTrackPos(dir * -wrap.clientWidth, true);
        haptic('light');
        setTimeout(() => {
          // Update state — this re-renders centre + pre-renders new adjacent panels
          App.changeDay(dir);
          // Instantly reset to centre (no animation) so new content is in view
          setTrackPos(0, false);
        }, 280);
      } else {
        setTrackPos(0, true);
      }
    }, { passive: true });

    wrap.addEventListener('touchcancel', () => {
      dragging = false;
      setTrackPos(0, true);
    }, { passive: true });
  }

  // ── Long-press to edit task ───────────────────────
  // NOTE: passive:true on touchstart so scroll is never blocked.
  // Text selection suppressed via CSS (user-select:none) + contextmenu preventDefault.
  const LONG_PRESS_MS = 600;

  function initLongPress() {
    let timer = null;
    let activeItem = null;
    let startX = 0, startY = 0;

    function cancel() {
      clearTimeout(timer);
      timer = null;
      if (activeItem) {
        activeItem.classList.remove('long-pressing');
        activeItem = null;
      }
    }

    // passive:true — scroll is fully preserved
    document.addEventListener('touchstart', e => {
      const item = e.target.closest('.schedule-item[data-id]');
      if (!item) return;

      activeItem = item;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      item.classList.add('long-pressing');

      timer = setTimeout(() => {
        if (!activeItem) return;
        haptic('heavy');
        item.classList.remove('long-pressing');
        item.classList.add('long-press-done');
        setTimeout(() => item.classList.remove('long-press-done'), 400);
        const id = activeItem.dataset.id;
        activeItem = null;
        timer = null;
        App.openTaskEditor(id);
      }, LONG_PRESS_MS);
    }, { passive: true }); // passive:true — scroll works perfectly

    document.addEventListener('touchmove', e => {
      if (!activeItem) return;
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 8 || dy > 8) cancel();
    }, { passive: true });

    document.addEventListener('touchend',    cancel, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });

    // Suppress native context menu (text selection popup) on task cards
    document.addEventListener('contextmenu', e => {
      if (e.target.closest('.schedule-item[data-id]')) e.preventDefault();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSwipe();
    initLongPress();
  });

  return {
    renderHeader,
    buildScheduleHtml,
    renderSchedule,
    fitWrap: _fitWrapToCurrentPanel,
    renderInlineNotes,
    renderNotesTab,
    renderStats,
    switchTab,
    toggleSetting,
    openModal,
    closeModal,
    handleModalOverlayClick,
    openTaskEditor,
    closeTaskEditor,
    handleTaskEditorOverlay,
    hideLoading,
    showSetup,
    showApp,
    getNoteInput,
    spinTime: () => {},
    getTimeFromSpinners,
    haptic,
  };

})();
