const dgram = require("dgram");
const { parseQuery, createResponse, createErrorResponse } = require("../lib/dns-parser");
const { getRecordsForDomain } = require("../lib/dns-resolver");
const { CLASS_IN } = require("../lib/types");

function startDnsUdpServer(port = 53) {
  const server = dgram.createSocket("udp4");

  server.on("error", (err) => {
    console.error(`DNS server error: ${err.message}`);
  });

  server.on("message", (msg, rinfo) => {
    let query;
    try {
      query = parseQuery(msg);
    } catch (err) {
      console.error(`DNS Query parsing failed from ${rinfo.address}:${rinfo.port} - ${err.message}`);
      // Extract Transaction ID if possible (first 2 bytes)
      const txId = msg.length >= 2 ? msg.readUInt16BE(0) : 0;
      const response = createErrorResponse(txId, 1); // RCODE 1 = FORMERR
      server.send(response, rinfo.port, rinfo.address, (sendErr) => {
        if (sendErr) console.error("Error sending FORMERR response:", sendErr);
      });
      return;
    }

    try {
      if (!query.questions || query.questions.length === 0) {
        console.warn("Received DNS Query with no questions — ignoring.");
        return;
      }

      const question = query.questions[0]; // Extracting the first question.

      console.log(
        `DNS Query: ${question.name} (Type ${question.type}) from ${rinfo.address}:${rinfo.port}`
      );

      if (question.class !== CLASS_IN) {
        const response = createResponse(query, []);
        server.send(response, rinfo.port, rinfo.address, (sendErr) => {
          if (sendErr) console.error("Error sending DNS response:", sendErr);
        });
        return;
      }

      const answers = getRecordsForDomain(question.name, question.type);
      const response = createResponse(query, answers);
      server.send(response, rinfo.port, rinfo.address, (sendErr) => {
        if (sendErr) console.error("Error sending DNS response:", sendErr);
      });
    } catch (err) {
      console.error("Error resolving DNS query:", err);
      try {
        const response = createResponse(query, [], 2); // RCODE 2 = SERVFAIL
        server.send(response, rinfo.port, rinfo.address, (sendErr) => {
          if (sendErr) console.error("Error sending SERVFAIL response:", sendErr);
        });
      } catch (innerErr) {
        console.error("Failed to build/send SERVFAIL response:", innerErr);
      }
    }
  });

  server.bind(port, () => console.log(`DNS server running on port ${port}`));
  return server;
}

module.exports = { startDnsUdpServer };
