const { parseQuery, createResponse } = require("../lib/dns-parser");
const { TYPE_A, CLASS_IN } = require("../lib/types");
const { writeDomainName } = require("../lib/dns-writer");
const { Buffer } = require("buffer");

function buildFakeQuery() {
  // simulating raw dns queryyyy
  const buffer = Buffer.alloc(512);
  let offset = 0;

  // DNS Header (ID = 1234, flags = standard query)
  buffer.writeUInt16BE(0x1234, offset);
  buffer.writeUInt16BE(0x0100, offset + 2); 
  buffer.writeUInt16BE(1, offset + 4); 
  buffer.writeUInt16BE(0, offset + 6); 
  buffer.writeUInt16BE(0, offset + 8); 
  buffer.writeUInt16BE(0, offset + 10);
  offset += 12;

  offset = writeDomainName(buffer, offset, "test.example.com");

  buffer.writeUInt16BE(TYPE_A, offset);
  offset += 2;
  buffer.writeUInt16BE(CLASS_IN, offset);
  offset += 2;

  return buffer.slice(0, offset);
}

function mockGetRecordsForDomain(domain, type) {
  if (domain === "test.example.com" && type === TYPE_A) {
    return [
      {
        type: TYPE_A,
        class: CLASS_IN,
        ttl: 300,
        data: "192.168.1.100",
      },
    ];
  }
  return [];
}

global.getRecordsForDomain = mockGetRecordsForDomain;

function test() {
  const rawQuery = buildFakeQuery();

  console.log("🧾 Raw Query Built");
  console.log(rawQuery.toString("hex"));

  const query = parseQuery(rawQuery);
  console.log("✅ Parsed Query:");
  console.dir(query, { depth: null });
  
  const answers = getRecordsForDomain(
    query.questions[0].name,
    query.questions[0].type
  );

  const response = createResponse(query, answers);
  console.log("✅ Created Response Buffer:", response.buffer.length, "bytes");
  console.log("✉️ Hex Output:", response.buffer.toString("hex"));

  console.log("✅ Answer Count:", response.answerCount);
}

test();
