const http = require('http');
const dns = require('dns').promises;
const net = require('net');

const ALLOWED_PORTS = [
  21, 22, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 8080
];
const MAX_PORTS = 20;
const MIN_TIMEOUT_MS = 1000;
const RATE_LIMIT_WINDOW_MS = 10_000;

const rateLimitMap = new Map();

function isPrivateIpv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) {
    return true;
  }
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
  return false;
}

function isPrivateIp(address) {
  if (!address) return true;
  if (net.isIP(address) === 4) return isPrivateIpv4(address);
  if (net.isIP(address) === 6) return isPrivateIpv6(address);
  return true;
}

function isValidDomain(target) {
  const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;
  return domainRegex.test(target);
}

function dedupePorts(ports) {
  return Array.from(new Set(ports));
}

function validatePorts(ports) {
  if (!Array.isArray(ports)) {
    throw new Error('Ports must be an array');
  }
  const uniquePorts = dedupePorts(ports.map(Number));
  if (uniquePorts.length === 0) {
    throw new Error('At least one port is required');
  }
  if (uniquePorts.length > MAX_PORTS) {
    throw new Error('Cannot scan more than 20 ports');
  }
  const invalid = uniquePorts.filter((p) => !ALLOWED_PORTS.includes(p));
  if (invalid.length > 0) {
    throw new Error('Ports must be in the allowed list');
  }
  return uniquePorts;
}

async function resolveTarget(target) {
  if (!target || typeof target !== 'string') {
    throw new Error('Target is required');
  }
  const trimmed = target.trim();
  if (trimmed.toLowerCase() === 'localhost') {
    throw new Error('Localhost is not allowed');
  }
  if (net.isIP(trimmed)) {
    if (isPrivateIp(trimmed)) {
      throw new Error('Private IPs are not allowed');
    }
    return { hostname: trimmed, address: trimmed };
  }
  if (!isValidDomain(trimmed)) {
    throw new Error('Invalid domain name');
  }
  const addresses = await dns.lookup(trimmed, { all: true });
  const publicAddress = addresses.find((entry) => !isPrivateIp(entry.address));
  if (!publicAddress) {
    throw new Error('Target resolves to a private IP');
  }
  return { hostname: trimmed, address: publicAddress.address };
}

function enforceRateLimit(clientId) {
  const now = Date.now();
  const last = rateLimitMap.get(clientId) || 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) {
    return false;
  }
  rateLimitMap.set(clientId, now);
  return true;
}

function performPortCheck(host, port, timeoutMs = MIN_TIMEOUT_MS) {
  const start = Date.now();
  const socket = new net.Socket();
  socket.setTimeout(Math.max(timeoutMs, MIN_TIMEOUT_MS));
  return new Promise((resolve) => {
    let resolved = false;

    const closeSocket = () => {
      if (!resolved) {
        socket.destroy();
        resolved = true;
      }
    };

    socket.once('connect', () => {
      const latency = Date.now() - start;
      resolve({ port, status: 'open', latency_ms: latency });
      closeSocket();
    });

    socket.once('timeout', () => {
      resolve({ port, status: 'filtered' });
      closeSocket();
    });

    socket.once('error', (err) => {
      if (err && err.code === 'ECONNREFUSED') {
        resolve({ port, status: 'closed' });
      } else {
        resolve({ port, status: 'filtered' });
      }
      closeSocket();
    });

    socket.connect({ host, port });
  });
}

async function handleScan(request, response) {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', async () => {
    try {
      const clientId = request.socket.remoteAddress || 'unknown';
      if (!enforceRateLimit(clientId)) {
        response.writeHead(429, corsHeaders());
        response.end(JSON.stringify({ error: 'Too many requests: wait 10 seconds between scans.' }));
        return;
      }

      const payload = JSON.parse(body || '{}');
      const { target, ports } = payload;
      const validatedPorts = validatePorts(ports);
      const { hostname, address } = await resolveTarget(target);

      const results = [];
      for (const port of validatedPorts) {
        const result = await performPortCheck(address, port);
        results.push(result);
      }

      response.writeHead(200, corsHeaders({ 'Content-Type': 'application/json' }));
      response.end(
        JSON.stringify({
          target: hostname,
          ip: address,
          results,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      const status = error.message.includes('rate') ? 429 : 400;
      response.writeHead(status, corsHeaders({ 'Content-Type': 'application/json' }));
      response.end(JSON.stringify({ error: error.message || 'Invalid request' }));
    }
  });
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.url === '/scan' && req.method === 'POST') {
    return handleScan(req, res);
  }

  res.writeHead(404, corsHeaders({ 'Content-Type': 'application/json' }));
  res.end(JSON.stringify({ error: 'Not found' }));
});

if (require.main === module) {
  const port = process.env.PORT || 3001;
  server.listen(port, () => {
    console.log(`Port scanner backend listening on port ${port}`);
  });
}

module.exports = {
  server,
  isPrivateIp,
  isValidDomain,
  validatePorts,
  performPortCheck,
  resolveTarget,
  ALLOWED_PORTS,
};
