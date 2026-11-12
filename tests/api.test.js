const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const { createDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');

describe('SpinCycle Bikes API Integration Tests', () => {
  let tempDir;
  let dbPath;
  let db;
  let server;
  let baseUrl;

  async function request(endpoint, options = {}) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    return { status: response.status, body };
  }

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spincycle-test-'));
    dbPath = path.join(tempDir, 'test.db');
    db = createDatabase(dbPath);
    await db.init();

    const app = createApp(db);
    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (db) {
      await db.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('enables SQLite foreign keys and creates the three required tables', async () => {
    const fkRow = await db.get('PRAGMA foreign_keys');
    assert.equal(fkRow.foreign_keys, 1);

    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    assert.deepEqual(
      tables.map((t) => t.name),
      ['bikes', 'rentals', 'riders']
    );
  });

  it('supports Rider APIs with validation and returns no dummy data initially', async () => {
    const emptyRes = await request('/riders');
    assert.equal(emptyRes.status, 200);
    assert.deepEqual(emptyRes.body, []);

    const invalidNameRes = await request('/riders', {
      method: 'POST',
      body: JSON.stringify({ name: '   ', phone: '555-1234' }),
    });
    assert.equal(invalidNameRes.status, 400);

    const invalidPhoneRes = await request('/riders', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice', phone: 'abc' }),
    });
    assert.equal(invalidPhoneRes.status, 400);

    const createRes1 = await request('/riders', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice Morgan', phone: '+1 555-0101' }),
    });
    assert.equal(createRes1.status, 201);
    assert.equal(createRes1.body.id, 1);
    assert.equal(createRes1.body.name, 'Alice Morgan');
    assert.equal(createRes1.body.phone, '+1 555-0101');

    const createRes2 = await request('/riders', {
      method: 'POST',
      body: JSON.stringify({ name: 'Brian Chen', phone: '555-0102' }),
    });
    assert.equal(createRes2.status, 201);
    assert.equal(createRes2.body.id, 2);

    const listRes = await request('/riders');
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.length, 2);
  });

  it('implements Bike CRUD, search, sequential bike_code generation, and non-reuse after delete', async () => {
    // Reject client-supplied bike_code on POST
    const clientCodeRes = await request('/bikes', {
      method: 'POST',
      body: JSON.stringify({
        bike_code: 'BKE-9999',
        name: 'Rogue Bike',
        type: 'Mountain',
      }),
    });
    assert.equal(clientCodeRes.status, 400);

    // Create first bike -> BKE-0001
    const bike1Res = await request('/bikes', {
      method: 'POST',
      body: JSON.stringify({ name: 'Summit X1', type: 'Mountain' }),
    });
    assert.equal(bike1Res.status, 201);
    assert.equal(bike1Res.body.bike_code, 'BKE-0001');
    assert.equal(bike1Res.body.status, 'available');

    // Create second bike -> BKE-0002
    const bike2Res = await request('/bikes', {
      method: 'POST',
      body: JSON.stringify({ name: 'City Glider', type: 'Hybrid' }),
    });
    assert.equal(bike2Res.status, 201);
    assert.equal(bike2Res.body.bike_code, 'BKE-0002');

    // Create third bike in maintenance -> BKE-0003
    const bike3Res = await request('/bikes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Apex Trail',
        type: 'Mountain',
        status: 'maintenance',
      }),
    });
    assert.equal(bike3Res.status, 201);
    assert.equal(bike3Res.body.bike_code, 'BKE-0003');
    assert.equal(bike3Res.body.status, 'maintenance');

    // Search by ?type=Mountain
    const searchRes = await request('/bikes?type=Mountain');
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.length, 2);
    assert.deepEqual(
      searchRes.body.map((b) => b.bike_code),
      ['BKE-0001', 'BKE-0003']
    );

    // Invalid empty ?type=
    const badSearchRes = await request('/bikes?type=');
    assert.equal(badSearchRes.status, 400);

    // GET /bikes/:id
    const singleRes = await request('/bikes/2');
    assert.equal(singleRes.status, 200);
    assert.equal(singleRes.body.bike_code, 'BKE-0002');

    const badIdRes = await request('/bikes/abc');
    assert.equal(badIdRes.status, 400);

    const missingIdRes = await request('/bikes/999');
    assert.equal(missingIdRes.status, 404);

    // Reject bike_code change during PUT /bikes/:id
    const rejectUpdateCodeRes = await request('/bikes/2', {
      method: 'PUT',
      body: JSON.stringify({
        bike_code: 'BKE-0099',
        name: 'City Glider Pro',
      }),
    });
    assert.equal(rejectUpdateCodeRes.status, 400);

    // Valid PUT /bikes/:id preserves bike_code
    const updateRes = await request('/bikes/2', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'City Glider Pro',
        type: 'Road',
        status: 'available',
      }),
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.bike_code, 'BKE-0002');
    assert.equal(updateRes.body.name, 'City Glider Pro');
    assert.equal(updateRes.body.type, 'Road');

    // Delete bike 2 (BKE-0002)
    const deleteRes = await request('/bikes/2', { method: 'DELETE' });
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.bike.bike_code, 'BKE-0002');

    const afterDeleteGet = await request('/bikes/2');
    assert.equal(afterDeleteGet.status, 404);

    // Next created bike must be BKE-0004 (never reusing BKE-0002 or BKE-0003)
    const bike4Res = await request('/bikes', {
      method: 'POST',
      body: JSON.stringify({ name: 'Campus Cruiser', type: 'Cruiser' }),
    });
    assert.equal(bike4Res.status, 201);
    assert.equal(bike4Res.body.bike_code, 'BKE-0004');
  });

  it('implements Rental APIs, prevents invalid/duplicate rentals, and returns JOIN details', async () => {
    // Non-existent rider
    const missingRiderRes = await request('/rentals', {
      method: 'POST',
      body: JSON.stringify({ rider_id: 999, bike_id: 1 }),
    });
    assert.equal(missingRiderRes.status, 404);

    // Non-existent bike
    const missingBikeRes = await request('/rentals', {
      method: 'POST',
      body: JSON.stringify({ rider_id: 1, bike_id: 999 }),
    });
    assert.equal(missingBikeRes.status, 404);

    // Maintenance bike cannot be rented (bike 3 is maintenance)
    const maintenanceRes = await request('/rentals', {
      method: 'POST',
      body: JSON.stringify({ rider_id: 1, bike_id: 3 }),
    });
    assert.equal(maintenanceRes.status, 409);

    // Valid rental of bike 1 by rider 1
    const rentalRes = await request('/rentals', {
      method: 'POST',
      body: JSON.stringify({
        rider_id: 1,
        bike_id: 1,
        rental_date: '2026-11-11T10:00:00.000Z',
      }),
    });
    assert.equal(rentalRes.status, 201);
    assert.equal(rentalRes.body.rider_id, 1);
    assert.equal(rentalRes.body.bike_id, 1);
    assert.equal(rentalRes.body.return_date, null);

    // Bike 1 should now be rented
    const bike1After = await request('/bikes/1');
    assert.equal(bike1After.body.status, 'rented');

    // Duplicate active rental of bike 1 must be rejected with 409
    const duplicateRentalRes = await request('/rentals', {
      method: 'POST',
      body: JSON.stringify({ rider_id: 2, bike_id: 1 }),
    });
    assert.equal(duplicateRentalRes.status, 409);

    // Deleting a currently rented bike must be rejected with 409
    const deleteRentedBikeRes = await request('/bikes/1', { method: 'DELETE' });
    assert.equal(deleteRentedBikeRes.status, 409);

    // Manually changing bike status while actively rented must be rejected with 409
    const manualStatusRes = await request('/bikes/1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'available' }),
    });
    assert.equal(manualStatusRes.status, 409);

    // GET /rentals
    const rentalsListRes = await request('/rentals');
    assert.equal(rentalsListRes.status, 200);
    assert.equal(rentalsListRes.body.length, 1);

    // GET /rentals/details (SQL JOIN)
    const detailsRes = await request('/rentals/details');
    assert.equal(detailsRes.status, 200);
    assert.equal(detailsRes.body.length, 1);
    assert.equal(detailsRes.body[0].rider_name, 'Alice Morgan');
    assert.equal(detailsRes.body[0].bike_name, 'Summit X1');
    assert.equal(detailsRes.body[0].bike_code, 'BKE-0001');
    assert.equal(detailsRes.body[0].bike_status, 'rented');

    // Return rental and rent again
    const returnRes = await request('/rentals/1/return', {
      method: 'PATCH',
      body: JSON.stringify({ return_date: '2026-11-11T12:00:00.000Z' }),
    });
    assert.equal(returnRes.status, 200);
    assert.equal(returnRes.body.return_date, '2026-11-11T12:00:00.000Z');

    const bike1Returned = await request('/bikes/1');
    assert.equal(bike1Returned.body.status, 'available');

    // Now rider 2 can rent bike 1
    const secondRentalRes = await request('/rentals', {
      method: 'POST',
      body: JSON.stringify({ rider_id: 2, bike_id: 1 }),
    });
    assert.equal(secondRentalRes.status, 201);
  });

  it('never reuses bike codes across database restarts even after deleting the latest bike', async () => {
    // Delete bike 4 (BKE-0004)
    const delRes = await request('/bikes/4', { method: 'DELETE' });
    assert.equal(delRes.status, 200);

    // Close server & DB, reopen on same file
    await new Promise((resolve) => server.close(resolve));
    await db.close();

    db = createDatabase(dbPath);
    await db.init();
    const app = createApp(db);
    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    const bike5Res = await request('/bikes', {
      method: 'POST',
      body: JSON.stringify({ name: 'Metro Sprint', type: 'Road' }),
    });
    assert.equal(bike5Res.status, 201);
    assert.equal(bike5Res.body.bike_code, 'BKE-0005');
  });

  it('regression: blocks POST /rentals with return_date on rented or maintenance bikes and blocks manual rented status on PUT /bikes/:id', async () => {
    // Bike 1 is currently rented (from earlier test), Bike 3 is in maintenance, Bike 5 is available
    const rentedWithReturnRes = await request('/rentals', {
      method: 'POST',
      body: JSON.stringify({
        rider_id: 1,
        bike_id: 1,
        rental_date: '2026-11-12T10:00:00.000Z',
        return_date: '2026-11-12T11:00:00.000Z',
      }),
    });
    assert.equal(rentedWithReturnRes.status, 409);

    const maintenanceWithReturnRes = await request('/rentals', {
      method: 'POST',
      body: JSON.stringify({
        rider_id: 1,
        bike_id: 3,
        rental_date: '2026-11-12T10:00:00.000Z',
        return_date: '2026-11-12T11:00:00.000Z',
      }),
    });
    assert.equal(maintenanceWithReturnRes.status, 409);

    // Cannot manually set an available bike (Bike 5) to 'rented' via PUT
    const manualRentedRes = await request('/bikes/5', {
      method: 'PUT',
      body: JSON.stringify({ status: 'rented' }),
    });
    assert.equal(manualRentedRes.status, 400);

    const bike5After = await request('/bikes/5');
    assert.equal(bike5After.body.status, 'available');

    // Updating name/type on an actively rented bike (Bike 1) while keeping status='rented' still succeeds
    const rentedBikeUpdateRes = await request('/bikes/1', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Summit X1 Updated',
        type: 'Mountain',
        status: 'rented',
      }),
    });
    assert.equal(rentedBikeUpdateRes.status, 200);
    assert.equal(rentedBikeUpdateRes.body.name, 'Summit X1 Updated');
    assert.equal(rentedBikeUpdateRes.body.bike_code, 'BKE-0001');
  });

  it('regression: serializes standalone writes with active transactions so rollbacks cannot revert concurrent writes', async () => {
    const beforeRiders = await request('/riders');
    const initialCount = beforeRiders.body.length;

    // Trigger a failing transaction alongside a concurrent standalone rider insert
    const [failedTx, riderInsert] = await Promise.all([
      db
        .withTransaction(async (tx) => {
          await tx.run(
            'INSERT INTO riders (name, phone) VALUES (?, ?)',
            ['Should Rollback', '555-9999']
          );
          await new Promise((resolve) => setTimeout(resolve, 25));
          throw new Error('Intentional transaction failure');
        })
        .catch((err) => err),
      request('/riders', {
        method: 'POST',
        body: JSON.stringify({ name: 'Concurrent Rider', phone: '555-0199' }),
      }),
    ]);

    assert.ok(failedTx instanceof Error);
    assert.equal(riderInsert.status, 201);

    const afterRiders = await request('/riders');
    assert.equal(afterRiders.body.length, initialCount + 1);
    assert.ok(
      afterRiders.body.some((r) => r.name === 'Concurrent Rider'),
      'Concurrent standalone write must persist despite transaction rollback'
    );
    assert.ok(
      !afterRiders.body.some((r) => r.name === 'Should Rollback'),
      'Failed transaction insert must still be rolled back'
    );
  });
});

