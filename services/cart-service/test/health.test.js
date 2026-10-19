const { test } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');

const PORT = 8081;

function waitForHealth(url, retries = 20) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http
        .get(url, (res) => resolve(res.statusCode))
        .on('error', () => {
          if (n <= 0) return reject(new Error('service did not become healthy in time'));
          setTimeout(() => attempt(n - 1), 250);
        });
    };
    attempt(retries);
  });
}

test('service responds healthy on /health', async () => {
  const child = spawn('node', ['src/index.js'], {
    env: { ...process.env, PORT: String(PORT) },
    cwd: __dirname + '/..',
  });

  try {
    const status = await waitForHealth(`http://localhost:${PORT}/health`);
    assert.strictEqual(status, 200);
  } finally {
    child.kill();
  }
});
