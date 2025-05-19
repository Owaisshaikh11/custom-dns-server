const { DEFAULT_TTL } = require("./types");

const dynamicSubdomains = new Map(); // Map to store live dynamic subdomains

// combines sub and domain to create into full domain name
function addDynamicSubdomain(sub, domain, ip, ttl = DEFAULT_TTL) { 
  const full = `${sub}.${domain}`;
  dynamicSubdomains.set(full, {
    ipAddress: ip,
    expires: Date.now() + ttl * 1000,
  });
  return full;
}

function removeDynamicSubdomain(sub, domain) {
  return dynamicSubdomains.delete(`${sub}.${domain}`);
}

function cleanupExpiredSubdomains() {
  const now = Date.now();
  for (const [key, val] of dynamicSubdomains.entries()) {
    if (now > val.expires) {
      dynamicSubdomains.delete(key);
    }
  }
}

module.exports = {
  dynamicSubdomains,
  addDynamicSubdomain,
  removeDynamicSubdomain,
  cleanupExpiredSubdomains,
};
