const { QR_MASK, AA_MASK, RD_MASK, RA_MASK, CLASS_IN } = require("./types");
const { writeDomainName, writeAnswer } = require("./dns-writer");

//! Rem to remove this shi* boii 
function getRecordsForDomain(domain, type) { // strictly for testing only vro 
  if (domain === 'test.example.com' && type === 1) {
    return [{
      type: 1,
      class: 1,
      ttl: 300,
      data: '192.168.1.100'
    }];
  }
  return [];
}
// }

function parseDomainName(buffer, offset) {
  const labels = [];
  let jumped = false;
  let jumpOffset = offset;
  let pointer = offset;

  while (true) {
    const length = buffer.readUInt8(pointer);
    if (length === 0) {
      pointer += 1;
      break;
    }

    if ((length & 0xc0) === 0xc0) {
      if (!jumped) jumpOffset = pointer + 2;
      pointer = ((length & 0x3f) << 8) | buffer.readUInt8(pointer + 1);
      jumped = true;
    } else {
      pointer += 1;
      labels.push(buffer.slice(pointer, pointer + length).toString("utf8"));
      pointer += length;
    }
  }

  return [labels.join("."), jumped ? jumpOffset : pointer];
}

function parseQuery(buffer) {
  let offset = 0;
  const header = {
    id: buffer.readUInt16BE(offset),
    flags: buffer.readUInt16BE(offset + 2),
    qdcount: buffer.readUInt16BE(offset + 4),
  };
  offset += 12;

  const questions = [];
  for (let i = 0; i < header.qdcount; i++) {
    const [name, newOffset] = parseDomainName(buffer, offset);
    offset = newOffset;
    const type = buffer.readUInt16BE(offset);
    offset += 2;
    const cls = buffer.readUInt16BE(offset);
    offset += 2;
    questions.push({ name, type, class: cls });
  }

  return { header, questions };
}

function createResponse(query, answers) {
  const buffer = Buffer.alloc(4096);
  let offset = 0;

  buffer.writeUInt16BE(query.header.id, 0);
  const flags = QR_MASK | AA_MASK | (query.header.flags & RD_MASK) | RA_MASK;
  buffer.writeUInt16BE(flags, 2);

  buffer.writeUInt16BE(1, 4); // QDCount
  const answerCountOffset = 6;
  buffer.writeUInt16BE(answers.length, answerCountOffset); // ANCount
  buffer.writeUInt16BE(0, 8); // NSCount
  buffer.writeUInt16BE(0, 10); // ARCount
  offset = 12;

  const question = query.questions[0];
  offset = writeDomainName(buffer, offset, question.name);
  buffer.writeUInt16BE(question.type, offset);
  offset += 2;
  buffer.writeUInt16BE(question.class, offset);
  offset += 2;

  for (const answer of answers) {
    offset = writeAnswer(buffer, offset, question.name, answer);
  }

  return buffer.slice(0, offset);
}

module.exports = {
  parseQuery,
  createResponse,
};
