const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || '',
  db: process.env.REDIS_DB || 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Helper functions for Redis operations
const redisHelpers = {
  async setRecord(domain, record, type = 'temp') {
    const key = `dns:${type}:${domain}`;
    await redis.set(key, JSON.stringify(record));
    if (type === 'temp' && record.ttl) {
      await redis.expire(key, record.ttl);
    }
    return true;
  },

  async getRecord(domain, type = 'temp') {
    // Try persistent first, then temp
    const persistentKey = `dns:persistent:${domain}`;
    const tempKey = `dns:temp:${domain}`;
    
    const persistentRecord = await redis.get(persistentKey);
    if (persistentRecord) {
      return JSON.parse(persistentRecord);
    }
    
    const tempRecord = await redis.get(tempKey);
    return tempRecord ? JSON.parse(tempRecord) : null;
  },

  async getAllRecords() {
    const persistentKeys = await redis.keys('dns:persistent:*');
    const tempKeys = await redis.keys('dns:temp:*');
    const records = {};
    
    for (const key of [...persistentKeys, ...tempKeys]) {
      const domain = key.split(':').pop();
      const record = await redis.get(key);
      if (record) {
        records[domain] = JSON.parse(record);
      }
    }
    
    return records;
  },

  async deleteRecord(domain, type = 'temp') {
    const persistentKey = `dns:persistent:${domain}`;
    const tempKey = `dns:temp:${domain}`;
    
    if (type === 'all') {
      await redis.del(persistentKey, tempKey);
    } else {
      const key = type === 'persistent' ? persistentKey : tempKey;
      await redis.del(key);
    }
    return true;
  },

  async setTTL(domain, ttl) {
    const key = `dns:temp:${domain}`;
    return await redis.expire(key, ttl);
  }
};

module.exports = {
  redis,
  redisHelpers
}; 