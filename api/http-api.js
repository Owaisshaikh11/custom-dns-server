const express = require("express");
const cors = require("cors");
const {
  dynamicSubdomains,
  addDynamicSubdomain,
  removeDynamicSubdomain,
} = require("../lib/dynamic-records");
const { getRecords } = require("../lib/record-manager");

function startHttpApi(port) {
  const app = express();

  app.use(express.json());
  app.use(cors());

  //* Routes
  
  app.get("/api/dns/subdomains", (req, res) => {
    const result = [...dynamicSubdomains.entries()].map(([domain, data]) => ({
      domain,
      ipAddress: data.ipAddress,
      expires: new Date(data.expires).toISOString(),
    }));
    res.json({ subdomains: result });
  });

  app.post("/api/dns/subdomains", (req, res) => {
    const { subdomain, domain, ipAddress, ttl } = req.body;

    if (!subdomain || !domain || !ipAddress) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const domainName = addDynamicSubdomain(subdomain, domain, ipAddress, ttl);
    res.json({ success: true, domain: domainName });
  });

  app.delete("/api/dns/subdomains", (req, res) => {
    const { subdomain, domain } = req.body;

    if (!subdomain || !domain) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const removed = removeDynamicSubdomain(subdomain, domain);
    res.status(removed ? 200 : 404).json({ success: removed });
  });

  app.get("/api/dns/records", (req, res) => {
    res.json(getRecords());
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const server = app.listen(port, () =>
    console.log(`HTTP API running on port ${port}`)
  );
  return server;
}

module.exports = { startHttpApi };
