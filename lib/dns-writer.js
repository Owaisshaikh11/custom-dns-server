const {
  TYPE_A,
  TYPE_AAAA,
  TYPE_NS,
  TYPE_CNAME,
  TYPE_MX,
  TYPE_TXT,
} = require("./types");

// splits the domain name into labels and writes them to the buffer
// eg([3]www[7]example[3]com[0]);
function writeDomainName(buffer, offset, domain) {
  const labels = domain.split(".");
  for (const label of labels) {
    buffer.writeUInt8(label.length, offset++);
    buffer.write(label, offset, label.length);
    offset += label.length;
  }
  buffer.writeUInt8(0, offset++);
  return offset;
}

function writeAnswer(buffer, offset, name, answer) {
  offset = writeDomainName(buffer, offset, name);
  buffer.writeUInt16BE(answer.type, offset);
  offset += 2; // moving the offset by {2} bytes and so on..
  buffer.writeUInt16BE(answer.class, offset);
  offset += 2;
  buffer.writeUInt32BE(answer.ttl, offset);
  offset += 4;

  const dataOffset = offset + 2;
  // The length of the data field is written at offset + 2 for reserve space for the length of data

  let length = 0;

  switch (
    answer.type // WRiting the data based on answer type
  ) {
    case TYPE_A:
      answer.data
        .split(".")
        .forEach((octet, i) => buffer.writeUInt8(+octet, dataOffset + i));
      length = 4;
      break;

    case TYPE_AAAA:
      answer.data
        .split(":")
        .forEach((part, i) =>
          buffer.writeUInt16BE(parseInt(part || "0", 16), dataOffset + i * 2)
        );
      length = 16;
      break;

    case TYPE_CNAME:
    case TYPE_NS:
      length = writeDomainName(buffer, dataOffset, answer.data) - dataOffset;
      break;

    case TYPE_MX:
      buffer.writeUInt16BE(answer.data.preference, dataOffset);
      length =
        2 +
        writeDomainName(buffer, dataOffset + 2, answer.data.exchange) -
        (dataOffset + 2);
      break;

    case TYPE_TXT:
      buffer.writeUInt8(answer.data.length, dataOffset);
      buffer.write(answer.data, dataOffset + 1);
      length = 1 + answer.data.length;
      break;
  }
  buffer.writeUInt16BE(length, offset); // Writing the length of the data into the buffer
  return dataOffset + length; //New offset after writing the data
}

module.exports = {
  writeDomainName,
  writeAnswer,
};
