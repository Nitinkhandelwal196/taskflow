require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { pool, initSchema } = require('./db');
const { redisClient, connectRedis } = require('./redisClient');
const tasksRouter = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Liveness probe - process is up
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

// Readiness probe - dependencies are reachable
app.get('/readyz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redisClient.ping();
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

app.use('/api/tasks', tasksRouter);

async function start() {
  try {
    await connectRedis();
    await initSchema();
    app.listen(PORT, () => {
      console.log(`TaskFlow backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();

module.exports = app;
