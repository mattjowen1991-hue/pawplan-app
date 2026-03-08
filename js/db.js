/* ═══════════════════════════════════════════════════
   PAWPLAN · js/db.js
   All Supabase interactions — auth, tasks & notes
════════════════════════════════════════════════════ */

const DB = (() => {

  // Hard-coded project credentials — no need to enter them manually
  const SUPABASE_URL = 'https://pyfmkxvzjzfegmvtegxa.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5Zm1reHZ6anpmZWdtdnRlZ3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTczNzYsImV4cCI6MjA4ODQ5MzM3Nn0.DAuABeUaWuK28OmuGbRZdhtW4r8q_he7x28Z5on0zlg';

  let client = null;
  let currentUser = null;

  // ── Init (called once on page load) ──────────────

  function init() {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }

  // ── Auth ──────────────────────────────────────────

  async function signUp(email, password, displayName) {
    const { data, error } = await client.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    currentUser = data.user;
    return data.user;
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    return data.user;
  }

  async function signOut() {
    await client.auth.signOut();
    currentUser = null;
  }

  // Returns existing session user, or null if not logged in
  async function getSession() {
    const { data } = await client.auth.getSession();
    if (data?.session?.user) {
      currentUser = data.session.user;
      return data.session.user;
    }
    return null;
  }

  function getUsername() {
    if (!currentUser) return '';
    return currentUser.user_metadata?.display_name
      || currentUser.email?.split('@')[0]
      || 'You';
  }

  function getUserId() {
    return currentUser?.id || null;
  }

  // ── Load all data for a given date ───────────────

  async function loadDay(dateStr) {
    if (!client) return { tasks: {}, notes: [] };
    try {
      const { data, error } = await client
        .from('pawplan_data')
        .select('*')
        .eq('date', dateStr)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tasks = {};
      const notes = [];

      (data || []).forEach(row => {
        if (row.type === 'task') {
          tasks[row.item_id] = row.completed;
        } else if (row.type === 'note') {
          notes.push(row);
        }
      });

      return { tasks, notes };
    } catch (e) {
      console.warn('[DB] loadDay error:', e.message);
      return { tasks: {}, notes: [] };
    }
  }

  // ── Toggle a task ─────────────────────────────────

  async function toggleTask(dateStr, itemId, newValue) {
    if (!client || !currentUser) return;
    try {
      const { data } = await client
        .from('pawplan_data')
        .select('id')
        .eq('date', dateStr)
        .eq('type', 'task')
        .eq('item_id', itemId)
        .maybeSingle();

      if (data) {
        await client
          .from('pawplan_data')
          .update({ completed: newValue, author: getUsername() })
          .eq('id', data.id);
      } else {
        await client.from('pawplan_data').insert({
          date: dateStr, type: 'task', item_id: itemId,
          completed: newValue, author: getUsername(),
          content: '', user_id: currentUser.id,
        });
      }
    } catch (e) {
      console.warn('[DB] toggleTask error:', e.message);
    }
  }

  // ── Add a note ────────────────────────────────────

  async function addNote(dateStr, text) {
    if (!client || !currentUser || !text.trim()) return null;
    const row = {
      date: dateStr, type: 'note',
      item_id: `note_${Date.now()}`,
      content: text.trim(), author: getUsername(),
      completed: false, created_at: new Date().toISOString(),
      user_id: currentUser.id,
    };
    try {
      const { error } = await client.from('pawplan_data').insert(row);
      if (error) throw error;
      return row;
    } catch (e) {
      console.warn('[DB] addNote error:', e.message);
      return row;
    }
  }

  // ── Delete a note ─────────────────────────────────

  async function deleteNote(itemId) {
    if (!client) return;
    try {
      await client.from('pawplan_data').delete().eq('item_id', itemId);
    } catch (e) {
      console.warn('[DB] deleteNote error:', e.message);
    }
  }

  // ── Save a custom / edited task ──────────────────
  // type = 'custom_task' for new, 'task_override' for edits to built-ins

  async function saveCustomTask(dateStr, task) {
    if (!client || !currentUser) return task;
    try {
      const { data } = await client
        .from('pawplan_data')
        .select('id')
        .eq('date', dateStr)
        .in('type', ['custom_task', 'task_override'])
        .eq('item_id', task.id)
        .maybeSingle();

      const payload = {
        date: dateStr,
        type: task._isNew ? 'custom_task' : 'task_override',
        item_id: task.id,
        content: JSON.stringify({ time: task.time, title: task.title, desc: task.desc, emoji: task.emoji, taskType: task.type, badge: task.badge || null }),
        author: getUsername(),
        completed: false,
        user_id: currentUser.id,
      };

      if (data) {
        await client.from('pawplan_data').update(payload).eq('id', data.id);
      } else {
        await client.from('pawplan_data').insert(payload);
      }
    } catch (e) {
      console.warn('[DB] saveCustomTask error:', e.message);
    }
    return task;
  }

  // ── Delete a custom task row ──────────────────────

  async function deleteCustomTask(dateStr, itemId) {
    if (!client) return;
    try {
      await client.from('pawplan_data')
        .delete()
        .eq('date', dateStr)
        .eq('item_id', itemId)
        .in('type', ['custom_task', 'task_override']);
    } catch (e) {
      console.warn('[DB] deleteCustomTask error:', e.message);
    }
  }

  // ── Load custom/override tasks for a date ─────────

  async function loadCustomTasks(dateStr) {
    if (!client) return [];
    try {
      const { data, error } = await client
        .from('pawplan_data')
        .select('*')
        .eq('date', dateStr)
        .in('type', ['custom_task', 'task_override']);
      if (error) throw error;
      return (data || []).map(row => {
        const parsed = JSON.parse(row.content || '{}');
        return {
          id: row.item_id,
          time: parsed.time || '',
          title: parsed.title || '',
          desc: parsed.desc || '',
          emoji: parsed.emoji || '📌',
          type: parsed.taskType || 'nova',
          badge: parsed.badge || null,
          _isNew: row.type === 'custom_task',
          _override: row.type === 'task_override',
        };
      });
    } catch (e) {
      console.warn('[DB] loadCustomTasks error:', e.message);
      return [];
    }
  }

  // ── Stats: load all data for stat calculations ────

  async function loadAllStats() {
    if (!client) return [];
    try {
      const { data, error } = await client
        .from('pawplan_data')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('[DB] loadAllStats error:', e.message);
      return [];
    }
  }

  return {
    init,
    signUp,
    signIn,
    signOut,
    getSession,
    getUsername,
    getUserId,
    loadDay,
    toggleTask,
    addNote,
    deleteNote,
    loadAllStats,
    saveCustomTask,
    deleteCustomTask,
    loadCustomTasks,
  };

})();
