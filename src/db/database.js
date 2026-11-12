const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'data', 'spincycle.db');

/**
 * Creates and initializes a SQLite database wrapper with Promise helpers,
 * foreign-key enforcement, and serialized transaction support.
 */
function createDatabase(dbPath = process.env.DB_PATH || DEFAULT_DB_PATH) {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new sqlite3.Database(dbPath);
  let opQueue = Promise.resolve();

  function enqueue(task) {
    const next = opQueue.then(task);
    opQueue = next.catch(() => {});
    return next;
  }

  function rawRun(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function onRun(err) {
        if (err) {
          return reject(err);
        }
        return resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  function rawGet(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          return reject(err);
        }
        return resolve(row);
      });
    });
  }

  function rawAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          return reject(err);
        }
        return resolve(rows);
      });
    });
  }

  function rawExec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  function run(sql, params = []) {
    return enqueue(() => rawRun(sql, params));
  }

  function get(sql, params = []) {
    return enqueue(() => rawGet(sql, params));
  }

  function all(sql, params = []) {
    return enqueue(() => rawAll(sql, params));
  }

  function exec(sql) {
    return enqueue(() => rawExec(sql));
  }

  /**
   * Executes an async callback inside a serialized SQLite IMMEDIATE transaction.
   * All standalone queries and transactions share `opQueue`, ensuring no external
   * write can interleave with an active transaction on this connection.
   */
  function withTransaction(work) {
    return enqueue(async () => {
      await rawRun('BEGIN IMMEDIATE');
      try {
        const result = await work({
          run: rawRun,
          get: rawGet,
          all: rawAll,
        });
        await rawRun('COMMIT');
        return result;
      } catch (err) {
        try {
          await rawRun('ROLLBACK');
        } catch (rollbackErr) {
          console.error('[DB Rollback Error]', rollbackErr);
        }
        throw err;
      }
    });
  }

  async function init() {
    // Enable SQLite foreign key constraints for this connection
    await run('PRAGMA foreign_keys = ON');

    await exec(`
      CREATE TABLE IF NOT EXISTS riders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bikes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bike_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance'))
      );

      CREATE TABLE IF NOT EXISTS rentals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rider_id INTEGER NOT NULL,
        bike_id INTEGER NOT NULL,
        rental_date TEXT NOT NULL,
        return_date TEXT,
        FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE RESTRICT,
        FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE RESTRICT
      );
    `);
  }

  function close() {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  return {
    db,
    dbPath,
    run,
    get,
    all,
    exec,
    withTransaction,
    init,
    close,
  };
}

module.exports = {
  createDatabase,
  DEFAULT_DB_PATH,
};

