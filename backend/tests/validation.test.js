const assert = require('assert');
const { describe, it } = require('node:test');
const { isPrivateIp, validatePorts, ALLOWED_PORTS } = require('../server');

const samplePrivate = ['10.0.0.1', '172.16.0.5', '192.168.1.1', '127.0.0.1', '::1', 'fe80::1'];
const samplePublic = ['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888'];

describe('isPrivateIp', () => {
  it('rejects common private ranges', () => {
    for (const ip of samplePrivate) {
      assert.strictEqual(isPrivateIp(ip), true, `${ip} should be private`);
    }
  });

  it('accepts public addresses', () => {
    for (const ip of samplePublic) {
      assert.strictEqual(isPrivateIp(ip), false, `${ip} should be public`);
    }
  });
});

describe('validatePorts', () => {
  it('allows allowed ports and removes duplicates', () => {
    const ports = [80, 443, 80];
    const validated = validatePorts(ports);
    assert.deepStrictEqual(validated, [80, 443]);
  });

  it('rejects disallowed ports', () => {
    assert.throws(() => validatePorts([9999]), /allowed list/);
  });

  it('rejects too many ports', () => {
    const largeList = Array.from({ length: 25 }, (_, i) => ALLOWED_PORTS[0]).map((p, i) => p + i);
    assert.throws(() => validatePorts(largeList), /Cannot scan more than 20/);
  });
});
