const assert = require('assert');
const net = require('net');
const { describe, it } = require('node:test');
const { performPortCheck } = require('../server');

function startTestServer(port) {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.end();
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

describe('performPortCheck', () => {
  it('detects open port', async () => {
    const port = 8080;
    const server = await startTestServer(port);
    const result = await performPortCheck('127.0.0.1', port, 1500);
    server.close();
    assert.strictEqual(result.status, 'open');
    assert.ok(typeof result.latency_ms === 'number');
  });

  it('detects closed or filtered port', async () => {
    const port = 8081;
    const result = await performPortCheck('127.0.0.1', port, 1200);
    assert.ok(['closed', 'filtered'].includes(result.status));
  });
});
