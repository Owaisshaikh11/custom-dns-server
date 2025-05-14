const { getRecords, cache } = require("./record-manager");
const {
  TYPE_A,
  TYPE_AAAA,
  TYPE_CNAME,
  TYPE_NS,
  TYPE_MX,
  TYPE_TXT,
  CLASS_IN,
  DEFAULT_TTL,
} = require("./types");
const { dynamicSubdomains } = require("./dynamic-records");

function getRecordsForDomain(domain, type) {
  const answers = [];
  const records = getRecords();
  const domainLower = domain.toLowerCase();

  if (dynamicSubdomains.has(domainLower)) {
    const data = dynamicSubdomains.get(domainLower);
    if (Date.now() < data.expires) {
      if (type === TYPE_A || type === 0) {
        answers.push({
          type: TYPE_A,
          class: CLASS_IN,
          ttl: Math.floor((data.expires - Date.now()) / 1000),
          data: data.ipAddress,
        });
        return answers;
      }
    } else {
      dynamicSubdomains.delete(domainLower);
    }
  }

  const cacheKey = `${domainLower}:${type}`;
  if (cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (Date.now() < entry.expires) return entry.records;
    cache.delete(cacheKey);
  }

  const add = (record, typeId, formatter = (x) => x) => {
    record?.forEach((data) =>
      answers.push({
        type: typeId,
        class: CLASS_IN,
        ttl: DEFAULT_TTL,
        data: formatter(data),
      })
    );
  };

  const match =
    records.domains[domainLower] ||
    records.domains[`*.${domainLower.split(".").slice(1).join(".")}`];

  if (match) {
    if (type === 0 || type === TYPE_A) add(match.A, TYPE_A);
    if (type === 0 || type === TYPE_AAAA) add(match.AAAA, TYPE_AAAA);
    if (type === 0 || type === TYPE_CNAME)
      match.CNAME &&
        answers.push({
          type: TYPE_CNAME,
          class: CLASS_IN,
          ttl: DEFAULT_TTL,
          data: match.CNAME,
        });
    if (type === 0 || type === TYPE_NS) add(match.NS, TYPE_NS);
    if (type === 0 || type === TYPE_MX) add(match.MX, TYPE_MX);
    if (type === 0 || type === TYPE_TXT) add(match.TXT, TYPE_TXT);
  }

  cache.set(cacheKey, {
    records: [...answers],
    expires: Date.now() + DEFAULT_TTL * 1000,
  });
  return answers;
}

module.exports = {
  getRecordsForDomain,
};
