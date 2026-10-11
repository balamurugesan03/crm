import http from 'http';
import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './config/db.js';
import { env, assertProductionConfig } from './config/env.js';
import { initSocket } from './realtime/socket.js';
import { registerAutomationListeners } from './services/automationService.js';
import { runMigrations } from './utils/migrations.js';
import { startScheduler } from './services/scheduler.js';

async function start() {
  assertProductionConfig();
  try {
    await connectDB();
    await runMigrations();
    const server = http.createServer(app);
    initSocket(server);
    registerAutomationListeners();
    startScheduler();
    server.listen(env.port, () => {
      console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv}) → public ${env.clientUrl}`);
    });
    const shutdown = (signal) => {
      console.log(`[server] ${signal} received, closing`);
      server.close(() => mongoose.connection.close().then(() => process.exit(0)));
      setTimeout(() => process.exit(0), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[server] failed to start', err);
    process.exit(1);
  }
}

start();
