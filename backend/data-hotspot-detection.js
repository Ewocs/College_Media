/**
 * ============================================================
 * DATA HOTSPOT DETECTION – NODE.JS
 * Issue: Missing Data Hotspot Detection (#744)
 * ============================================================
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

/* ============================================================
   CONFIG
============================================================ */
const CONFIG = {
  PORT: process.env.PORT || 3000,
  HOTSPOT_THRESHOLD: 50, // requests per key
  WINDOW_MS: 60 * 1000, // 1 minute window
};

/* ============================================================
   IN-MEMORY ACCESS TRACKER
============================================================ */
class AccessTracker {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.accessMap = new Map();
    this.lastReset = Date.now();
  }

  track(key, type) {
    this._resetIfNeeded();

    const entry =
      this.accessMap.get(key) || { reads: 0, writes: 0 };

    if (type === 'read') entry.reads++;
    if (type === 'write') entry.writes++;

    this.accessMap.set(key, entry);
  }

  hotspots(threshold) {
    const result = [];
    for (const [key, val] of this.accessMap.entries()) {
      if (val.reads + val.writes >= threshold) {
        result.push({
          key,
          reads: val.reads,
          writes: val.writes,
          total: val.reads + val.writes,
        });
      }
    }
    return result.sort((a, b) => b.total - a.total);
  }

  _resetIfNeeded() {
    if (Date.now() - this.lastReset > this.windowMs) {
      this.accessMap.clear();
      this.lastReset = Date.now();
    }
  }
}

const tracker = new AccessTracker(CONFIG.WINDOW_MS);

/* ============================================================
   MOCK DATABASE
============================================================ */
const db = {
  records: {},
};

function generateId() {
  return crypto.randomBytes(5).toString('hex');
}

/* ============================================================
   ROUTES WITH HOTSPOT TRACKING
============================================================ */

// CREATE (write)
app.post('/records', (req, res) => {
  const id = generateId();
  db.records[id] = { id, value: req.body.value };

  tracker.track(`record:${id}`, 'write');

  res.status(201).json(db.records[id]);
});

// READ ONE
app.get('/records/:id', (req, res) => {
  const record = db.records[req.params.id];
  if (!record) {
    return res.status(404).json({ error: 'Not found' });
  }

  tracker.track(`record:${req.params.id}`, 'read');
  res.json(record);
});

// UPDATE (write)
app.put('/records/:id', (req, res) => {
  const record = db.records[req.params.id];
  if (!record) {
    return res.status(404).json({ error: 'Not found' });
  }

  db.records[req.params.id].value = req.body.value;
  tracker.track(`record:${req.params.id}`, 'write');

  res.json(db.records[req.params.id]);
});

// LIST ALL (table-level hotspot)
app.get('/records', (req, res) => {
  tracker.track('table:records', 'read');
  res.json(Object.values(db.records));
});

/* ============================================================
   HOTSPOT METRICS
============================================================ */
app.get('/metrics/hotspots', (req, res) => {
  res.json({
    windowMs: CONFIG.WINDOW_MS,
    threshold: CONFIG.HOTSPOT_THRESHOLD,
    hotspots: tracker.hotspots(CONFIG.HOTSPOT_THRESHOLD),
  });
});

/* ============================================================
   HEALTH
============================================================ */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    trackedKeys: tracker.accessMap.size,
  });
});

/* ============================================================
   SERVER
============================================================ */
app.listen(CONFIG.PORT, () => {
  console.log(
    `🚀 Data Hotspot Detection server running on port ${CONFIG.PORT}`
  );
});
