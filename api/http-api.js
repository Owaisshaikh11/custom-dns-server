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
      expires: data.expires ? new Date(data.expires).toISOString() : null,
      isPersistent: data.isPersistent
    }));
    res.json({ subdomains: result });
  });

  app.post("/api/dns/subdomains", async (req, res) => {
    const { subdomain, domain, ipAddress, ttl, isPersistent } = req.body;

    if (!subdomain || !domain || !ipAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const domainName = await addDynamicSubdomain(
        subdomain, 
        domain, 
        ipAddress, 
        ttl, 
        isPersistent
      );
      res.json({ 
        success: true, 
        domain: domainName,
        isPersistent: isPersistent || false
      });
    } catch (error) {
      console.error('Error adding subdomain:', error);
      res.status(500).json({ error: "Failed to add subdomain" });
    }
  });

  app.delete("/api/dns/subdomains", async (req, res) => {
    const { subdomain, domain, type = 'all' } = req.body;

    if (!subdomain || !domain) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const removed = await removeDynamicSubdomain(subdomain, domain, type);
      res.status(removed ? 200 : 404).json({ success: removed });
    } catch (error) {
      console.error('Error removing subdomain:', error);
      res.status(500).json({ error: "Failed to remove subdomain" });
    }
  });

  app.get("/api/dns/records", (req, res) => {
    res.json(getRecords());
  });

  return app.listen(port, () => {
    console.log(`HTTP API server running on port ${port}`);
  });
}

module.exports = { startHttpApi };
