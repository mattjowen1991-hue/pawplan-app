/* ═══════════════════════════════════════════════════
   PAWPLAN · js/db.js
   All Supabase interactions — tasks & notes
════════════════════════════════════════════════════ */

const DB = (() => {

  let client = null;
  let username = '';

  // ── Init ──────────────────────────────────────────

  function init(url, key, name) {
    client = window.supabase.createClient(url, key);
    username = name;
  }

  // ── Connection test ───────────────────────────────

  async function testConnection() {
    try {
      const { error } = await client.from('pawplan_data').select('id').limit(1);
      // 42P01 = table doesn't exist yet — still "connected", just needs setup
      if (error && error.code !== '42P01') throw error;
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message };
    }
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
    if (!client) return;
    try {
      // Check for existing row
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
          .update({ completed: newValue, author: username })
          .eq('id', data.id);
      } else {
        await client.from('pawplan_data').insert({
          date: dateStr,
          type: 'task',
          item_id: itemId,
          completed: newValue,
          author: username,
          content: '',
        });
      }
    } catch (e) {
      console.warn('[DB] toggleTask error:', e.message);
    }
  }

  // ── Add a note ────────────────────────────────────

  async function addNote(dateStr, text) {
    if (!client || !text.trim()) return null;
    const row = {
      date: dateStr,
      type: 'note',
      item_id: `note_${Date.now()}`,
      content: text.trim(),
      author: username,
      completed: false,
      created_at: new Date().toISOString(),
    };
    try {
      const { error } = await client.from('pawplan_data').insert(row);
      if (error) throw error;
      return row;
    } catch (e) {
      console.warn('[DB] addNote error:', e.message);
      return row; // still return so UI updates optimistically
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
    if (!client) return task;
    try {
      // Check if an override/custom already exists for this item_id + date
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
        author: username,
        completed: false,
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
    testConnection,
    loadDay,
    toggleTask,
    addNote,
    deleteNote,
    loadAllStats,
    saveCustomTask,
    deleteCustomTask,
    loadCustomTasks,
    getUsername: () => username,
  };

})();
