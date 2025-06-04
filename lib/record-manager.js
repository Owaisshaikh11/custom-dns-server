const fs = require("fs");
const path = require("path");
const { DEFAULT_TTL } = require("./types");
const { redisHelpers } = require("../config/redis-config");

const cache = new Map();
let records = {};

async function loadRecords(filePath) {
  try {
    // First try to load from Redis
    const redisRecords = await redisHelpers.getAllRecords();
    if (Object.keys(redisRecords).length > 0) {
      records = redisRecords;
      console.log('Loaded DNS records from Redis');
      return;
    }

    // Fallback to file if Redis is empty
    const raw = fs.readFileSync(filePath, "utf8");
    records = JSON.parse(raw);
    
    // Sync file records to Redis
    for (const [domain, record] of Object.entries(records)) {
      await redisHelpers.setRecord(domain, record);
    }
    
    console.log(`Loaded DNS records from ${filePath} and synced to Redis`);
  } catch (err) {
    if (err.code === "ENOENT") {
      fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
      console.log(`Created default records at ${filePath}`);
    } else {
      console.error(`Error loading records: ${err.message}`);
    }
  }
}

async function saveRecords(filePath) {
  try {
    // Save to Redis
    for (const [domain, record] of Object.entries(records)) {
      await redisHelpers.setRecord(domain, record);
    }
    
    // Backup to file
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
    console.log(`Saved DNS records to Redis and backed up to ${filePath}`);
  } catch (err) {
    console.error(`Error saving records: ${err.message}`);
  }
}

async function getRecords() {
  // Try to get from Redis first
  const redisRecords = await redisHelpers.getAllRecords();
  if (Object.keys(redisRecords).length > 0) {
    records = redisRecords;
  }
  return records;
}

async function addRecord(domain, record) {
  records[domain] = record;
  await redisHelpers.setRecord(domain, record);
  if (record.ttl) {
    await redisHelpers.setTTL(domain, record.ttl);
  }
}

async function removeRecord(domain) {
  delete records[domain];
  await redisHelpers.deleteRecord(domain);
}

module.exports = {
  cache,
  loadRecords,
  saveRecords,
  getRecords,
  addRecord,
  removeRecord
};
