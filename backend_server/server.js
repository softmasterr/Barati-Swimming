/**
 * Server Entrypoint - Barati Swimming Academy Cloud Backend
 * Initializes SQLite database and launches HTTP server with graceful shutdown handling.
 */

import { initDatabase, closeDatabase } from './src/db/database.js';
import { app } from './src/app.js';
import { config } from './src/config/env.js';
import { authLockoutManager } from './src/middleware/rateLimiter.js';
import { adminController } from './src/controllers/adminController.js';

// 1. Initialize SQLite Database & apply migrations
try {
  initDatabase();
  console.log('[DB] Database initialized successfully.');
  await adminController.ensureInitialAdmin();
} catch (err) {
  console.error('[DB] Fatal database initialization failure:', err);
  process.exit(1);
}

// 2. Start HTTP server
const PORT = config.port || 3000;
const server = app.listen(PORT, () => {
  console.log(`[SERVER] Barati Swimming Cloud Server listening on port ${PORT} (${config.nodeEnv})`);
});

// 3. Graceful shutdown handlers
function handleShutdown(signal) {
  console.log(`[SERVER] Received ${signal}. Shutting down gracefully...`);
  try {
    authLockoutManager.stopCleanup();
    console.log('[SERVER] Auth lockout cleanup stopped.');
  } catch (err) {
    console.error('[SERVER] Error stopping auth lockout cleanup:', err);
  }
  server.close(() => {
    console.log('[SERVER] HTTP server closed.');
    try {
      closeDatabase();
      console.log('[SERVER] Database closed cleanly.');
    } catch (err) {
      console.error('[SERVER] Error closing database:', err);
    }
    process.exit(0);
  });

  // Force close if graceful shutdown hangs
  setTimeout(() => {
    console.error('[SERVER] Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export { server };
