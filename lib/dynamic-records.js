const { DEFAULT_TTL } = require("./types");
const { redisHelpers } = require("../config/redis-config");

const dynamicSubdomains = new Map(); // Map to store live dynamic subdomains

// Load dynamic subdomains from Redis on startup
async function loadDynamicSubdomains() {
  try {
    const records = await redisHelpers.getAllRecords();
    for (const [domain, record] of Object.entries(records)) {
      if (record.isDynamic) {
        dynamicSubdomains.set(domain, {
          ipAddress: record.value,
          expires: record.expires,
          isPersistent: record.isPersistent
        });
      }
    }
    console.log('Loaded dynamic subdomains from Redis');
  } catch (error) {
    console.error('Error loading dynamic subdomains:', error);
  }
}

// combines sub and domain to create into full domain name
async function addDynamicSubdomain(sub, domain, ip, ttl = DEFAULT_TTL, isPersistent = false) {
  const full = `${sub}.${domain}`;
  const expires = isPersistent ? null : Date.now() + ttl * 1000;
  
  // Store in memory
  dynamicSubdomains.set(full, {
    ipAddress: ip,
    expires: expires,
    isPersistent: isPersistent
  });

  // Store in Redis
  await redisHelpers.setRecord(full, {
    type: 'A',
    value: ip,
    ttl: isPersistent ? null : ttl,
    expires: expires,
    isDynamic: true,
    isPersistent: isPersistent
  }, isPersistent ? 'persistent' : 'temp');

  return full;
}

async function removeDynamicSubdomain(sub, domain, type = 'all') {
  const full = `${sub}.${domain}`;
  const removed = dynamicSubdomains.delete(full);
  
  if (removed) {
    // Remove from Redis
    await redisHelpers.deleteRecord(full, type);
  }
  
  return removed;
}

async function cleanupExpiredSubdomains() {
  const now = Date.now();
  for (const [key, val] of dynamicSubdomains.entries()) {
    if (!val.isPersistent && now > val.expires) {
      dynamicSubdomains.delete(key);
      // Remove from Redis
      await redisHelpers.deleteRecord(key, 'temp');
    }
  }
}

// Initialize by loading subdomains from Redis
loadDynamicSubdomains();

module.exports = {
  dynamicSubdomains,
  addDynamicSubdomain,
  removeDynamicSubdomain,
  cleanupExpiredSubdomains,
};
