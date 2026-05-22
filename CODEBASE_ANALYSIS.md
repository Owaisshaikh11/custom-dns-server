# Codebase Analysis: Custom DNS Server

## 1. Security Issues

### 1.1 DNS Message Parsing (Infinite Loop Vulnerability)
In `lib/dns-parser.js`, the `parseDomainName` function processes DNS message compression pointers (`0xC0`). A maliciously crafted UDP packet with a pointer that points to itself or creates a cycle will cause an infinite loop:
```javascript
  while (true) {
    // ...
    if ((length & 0xc0) === 0xc0) {
      // pointer to another name (compression)
      // Vulnerability: No limit on jumps!
```
**Fix:** Introduce a maximum jump count (e.g., 10 or 20) or track visited offsets to prevent infinite loops.

### 1.2 Unsecured HTTP API
In `api/http-api.js`, the Express server exposes endpoints (`POST /api/dns/subdomains`, `DELETE /api/dns/subdomains`) to modify the DNS server's state.
```javascript
function startHttpApi(port) {
  const app = express();
  app.use(express.json());
  app.use(cors());
  // ... Routes have no authentication middleware ...
```
**Fix:** Implement an API key authentication middleware or require an Authorization header to restrict access to these endpoints.

### 1.3 Missing Input Validation and Sanitization
The HTTP API endpoints do not adequately validate user input. For example, `subdomain` and `domain` could contain invalid characters (like shell metacharacters or excessively long strings) which may cause issues.
**Fix:** Use an input validation library (like `zod` or `joi`) or regex checks to enforce valid DNS label syntax.

## 2. Implementation Issues & Bugs

### 2.1 Asynchronous `getRecords` Mishandling
In `lib/record-manager.js`, `getRecords()` is declared as an `async` function (returns a Promise):
```javascript
async function getRecords() {
  // Try to get from Redis first
  const redisRecords = await redisHelpers.getAllRecords();
  if (Object.keys(redisRecords).length > 0) {
    records = redisRecords;
  }
  return records;
}
```
However, in `lib/dns-resolver.js` and `api/http-api.js`, it is called synchronously:
```javascript
// In lib/dns-resolver.js
const records = getRecords();
const match = records.domains[domainLower] // Unhandled promise rejection / undefined error
```
**Fix:** `getRecords()` must be `await`ed where used, or the records should be retrieved from an in-memory cache that is updated periodically.

### 2.2 IPv6 (AAAA) Record Compression Bug
In `lib/dns-writer.js`, the IPv6 address writing logic assumes an uncompressed IPv6 address separated by colons:
```javascript
    case TYPE_AAAA:
      answer.data
        .split(":")
        .forEach((part, i) =>
          buffer.writeUInt16BE(parseInt(part || "0", 16), dataOffset + i * 2)
        );
      length = 16;
      break;
```
If an address is compressed (e.g., `2001:db8::1`), `split(":")` will not produce 8 segments, causing data to be written incorrectly or out of bounds, as length is hardcoded to 16.
**Fix:** Use an IP address parsing library (e.g., `ipaddr.js`) or implement proper IPv6 expansion before writing bytes.

### 2.3 UDP Response Size Limits and Truncation (EDNS0)
The DNS response buffer is strictly allocated at 4096 bytes:
```javascript
const buffer = Buffer.alloc(4096);
```
Standard DNS over UDP is limited to 512 bytes without EDNS0. Large responses over UDP might be dropped by routers or clients if they exceed 512 bytes unless EDNS0 is supported.
**Fix:** Support EDNS0 or properly set the Truncation (TC) flag if the response exceeds 512 bytes, instructing the client to retry via TCP. (Requires adding TCP server support).

### 2.4 Caching Logic Inconsistency
In `lib/dns-resolver.js`:
```javascript
  //Storing the records in cache with expiry timestamp
  cache.set(cacheKey, {
    records: [...answers],
    expires: Date.now() + DEFAULT_TTL * 1000,
  });
```
This cache stores resolutions based on static files/redis indefinitely, but there is no invalidation mechanism if the underlying `dns-records.json` or static Redis records change.

### 2.5 `getRecordsForDomain` Question Type Fallback
In `lib/dns-resolver.js`, the resolution logic checks:
```javascript
if (type === 0 || type === TYPE_A) add(match.A, TYPE_A);
```
Type `0` is not a valid DNS query type. A query for `ANY` (255) might be what was intended.

### 2.6 Missing Promise Rejection Handling
In `server/dns-server.js`:
```javascript
      const answers = getRecordsForDomain(
        query.questions[0].name,
        query.questions[0].type
      );
```
If `getRecordsForDomain` becomes `async` (to fix the `getRecords()` issue), this code needs to `await` it, and wrap it in a `try/catch` properly, otherwise unhandled promise rejections will crash the server.

## 3. Lacking Features (Enhancements)

### 3.1 TCP Support
DNS servers must handle TCP queries for responses larger than 512 bytes (or zone transfers). The current server only implements UDP.

### 3.2 Proper Logging and Telemetry
Currently using `console.log` and `console.error`. A production-like server should use a logging framework (like `winston` or `pino`) that supports log levels, rotating files, and structured JSON logs.

### 3.3 Forwarding / Recursive Resolution
The server currently only serves authoritative answers for the domains configured. If queried for external domains (e.g., `google.com`), it fails silently or returns an empty answer. It lacks a forwarder mechanism to resolve upstream queries.

### 3.4 Rate Limiting
To prevent DNS Amplification attacks or simple DoS attacks, the UDP server should implement source IP-based rate limiting. The HTTP API should also be rate-limited.

### 3.5 Unit and Integration Testing
The project has `jest` listed in `package.json`, but no actual test files are present. Robust unit tests for the parser/writer and integration tests for the API/Redis are essential.
