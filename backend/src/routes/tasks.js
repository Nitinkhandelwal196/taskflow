const express = require('express');
const { pool } = require('../db');
const { redisClient, TASKS_CACHE_KEY } = require('../redisClient');

const router = express.Router();

const CACHE_TTL_SECONDS = 30;

// GET /api/tasks - list all tasks (cache-aside pattern via Redis)
router.get('/', async (req, res) => {
  try {
    const cached = await redisClient.get(TASKS_CACHE_KEY);
    if (cached) {
      return res.json({ source: 'cache', tasks: JSON.parse(cached) });
    }

    const result = await pool.query(
      'SELECT * FROM tasks ORDER BY created_at DESC'
    );
    await redisClient.setEx(
      TASKS_CACHE_KEY,
      CACHE_TTL_SECONDS,
      JSON.stringify(result.rows)
    );
    res.json({ source: 'db', tasks: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks - create a task
router.post('/', async (req, res) => {
  const { title, description } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING *',
      [title.trim(), description || '']
    );
    await redisClient.del(TASKS_CACHE_KEY);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /api/tasks/:id - update status/title/description
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, status } = req.body;
  const validStatuses = ['todo', 'in_progress', 'done'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const result = await pool.query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [title, description, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    await redisClient.del(TASKS_CACHE_KEY);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    await redisClient.del(TASKS_CACHE_KEY);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
