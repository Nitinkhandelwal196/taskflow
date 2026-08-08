import React, { useEffect, useState, useCallback } from 'react';

// In production this is injected via env var / configmap; in local dev,
// Vite's dev server proxies to the backend container.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const LANES = [
  { status: 'todo', label: 'Backlog' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'done', label: 'Shipped' },
];

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = await res.json();
      setTasks(data.tasks || []);
      setSource(data.source || null);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function addTask(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      setTitle('');
      await fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateStatus(id, status) {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      await fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteTask(id) {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Failed to delete task');
      await fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  function nextStatus(current) {
    if (current === 'todo') return 'in_progress';
    if (current === 'in_progress') return 'done';
    return null;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">taskflow / pipeline board</p>
          <h1>TaskFlow</h1>
        </div>
        {source && (
          <span className={`status-pill ${source === 'cache' ? 'cache-hit' : ''}`}>
            {source === 'cache' ? '⚡ served from redis' : '● served from postgres'}
          </span>
        )}
      </header>

      {error && <div className="error-banner">{error}</div>}

      <form className="new-task" onSubmit={addTask}>
        <input
          type="text"
          placeholder="Add a task to the backlog…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" disabled={!title.trim()}>ADD TASK</button>
      </form>

      <div className="board">
        {LANES.map((lane) => {
          const laneTasks = tasks.filter((t) => t.status === lane.status);
          return (
            <div className="lane" data-status={lane.status} key={lane.status}>
              <div className="lane-head">
                <span className="dot" />
                {lane.label} ({laneTasks.length})
              </div>
              <div className="lane-body">
                {!loading && laneTasks.length === 0 && (
                  <div className="empty-lane">Nothing here yet.</div>
                )}
                {laneTasks.map((task) => (
                  <div className="task-card" key={task.id}>
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                    <div className="task-actions">
                      {nextStatus(task.status) && (
                        <button onClick={() => updateStatus(task.id, nextStatus(task.status))}>
                          MOVE → {nextStatus(task.status).replace('_', ' ')}
                        </button>
                      )}
                      <button className="delete" onClick={() => deleteTask(task.id)}>
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
