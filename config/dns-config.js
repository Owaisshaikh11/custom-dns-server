const dnsConfig = {
  forwardEnabled: process.env.DNS_FORWARD_ENABLED !== "false", // Default to true unless explicitly disabled
  upstreamServers: (process.env.DNS_UPSTREAM_SERVERS || "8.8.8.8,8.8.4.4")
    .split(",")
    .map((server) => {
      const trimmed = server.trim();
      if (!trimmed) return null;

      // Parse host and port if specified (e.g. "127.0.0.1:5353" or "[::1]:5353")
      const lastColon = trimmed.lastIndexOf(":");
      if (lastColon !== -1) {
        const portStr = trimmed.slice(lastColon + 1);
        const port = Number(portStr);
        if (!isNaN(port) && port > 0 && port <= 65535) {
          let host = trimmed.slice(0, lastColon);
          // strip brackets from IPv6 host if present
          if (host.startsWith("[") && host.endsWith("]")) {
            host = host.slice(1, -1);
          }
          return { host, port };
        }
      }

      return { host: trimmed, port: 53 };
    })
    .filter(Boolean),
  forwardTimeout: Number(process.env.DNS_FORWARD_TIMEOUT) || 2000, // Timeout in ms, default to 2 seconds
};

module.exports = { dnsConfig };
