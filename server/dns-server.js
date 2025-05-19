const dgram = require("dgram");
const { parseQuery, createResponse } = require("../lib/dns-parser");
const { getRecordsForDomain } = require("../lib/dns-resolver");

function startDnsUdpServer(port = 53) {
  const server = dgram.createSocket("udp4");

  server.on("error", (err) => {
    console.error(`DNS server error: ${err.message}`);
  });

  //rinfo : info about the client who sent it(ip & port of client)
  //msg : the message sent by the client(raw query packet)
  server.on("message", (msg, rinfo) => {
    try {
      const query = parseQuery(msg);

      if (!query.questions || query.questions.length === 0) {
        console.warn("Received DNS Query with no questions — ignoring.");
        return;
      }

      const question = query.questions[0];// Extracting the first question.

      console.log(
        `DNS Query: ${question.name} (Type ${question.type}) from ${rinfo.address}:${rinfo.port}`
      ); // Logging the basic DNS query

      const answers = getRecordsForDomain(
        query.questions[0].name,
        query.questions[0].type
      );
      const response = createResponse(query, answers);
      server.send(response, rinfo.port, rinfo.address);
    } catch (err) {
      console.error("Error processing DNS query:", err);
    }
  });

  server.bind(port, () => console.log(`DNs server running on port ${port}`));
  return server;
}
module.exports = { startDnsUdpServer };
