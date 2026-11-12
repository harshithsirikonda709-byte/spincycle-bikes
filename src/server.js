const { createDatabase } = require('./db/database');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const db = createDatabase();
  await db.init();

  const app = createApp(db);

  const server = app.listen(PORT, () => {
    console.log(`SpinCycle Bikes server listening on http://localhost:${PORT}`);
  });

  async function shutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await db.close();
        console.log('SQLite database connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('Failed to start SpinCycle Bikes server:', err);
  process.exit(1);
});

