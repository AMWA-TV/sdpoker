const fs = require('fs');
const http = require('http');
const path = require('path');
const test = require('tape');
const { getSDP } = require('../index.js');

const fixtureBody = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'valid', 'st2110-10.sdp'),
  'utf8'
);

// getSDP's HTTP path (used by the CLI for http(s) URLs) is otherwise untested;
// these cases exercise success, Content-Type checks, and non-success responses.
function startServer(requestHandler) {
  const server = http.createServer(requestHandler);
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', err => {
      if (err) {
        reject(err);
        return;
      }
      resolve(server);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  });
}

function serverUrl(server, requestPath = '/') {
  return `http://127.0.0.1:${server.address().port}${requestPath}`;
}

test('getSDP downloads an SDP over HTTP when Content-Type is application/sdp', async t => {
  const server = await startServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/sdp' });
    response.end(fixtureBody);
  });

  try {
    const sdp = await getSDP(serverUrl(server, '/st2110-10.sdp'));
    t.equal(sdp, fixtureBody, 'returns the SDP response body');
  } finally {
    await closeServer(server);
    t.end();
  }
});

test('getSDP accepts application/sdp with a charset parameter', async t => {
  const server = await startServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/sdp; charset=utf-8' });
    response.end(fixtureBody);
  });

  try {
    const sdp = await getSDP(serverUrl(server, '/st2110-10.sdp'));
    t.equal(sdp, fixtureBody, 'returns the SDP response body');
  } finally {
    await closeServer(server);
    t.end();
  }
});

test('getSDP rejects responses that are not application/sdp', async t => {
  const server = await startServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end(fixtureBody);
  });

  try {
    await getSDP(serverUrl(server, '/st2110-10.sdp'));
    t.fail('expected getSDP to reject a non-SDP Content-Type');
  } catch (error) {
    t.ok(
      /Media type \(MIME type\/Content-Type\)/.test(error.message),
      'rejects with a Content-Type / media type error'
    );
  } finally {
    await closeServer(server);
    t.end();
  }
});

test('getSDP rejects non-success HTTP responses', async t => {
  const server = await startServer((_request, response) => {
    response.writeHead(404, { 'Content-Type': 'application/sdp' });
    response.end('not found');
  });

  try {
    await getSDP(serverUrl(server, '/missing.sdp'));
    t.fail('expected getSDP to reject a non-success status');
  } catch (error) {
    t.ok(error instanceof Error, 'rejects with an Error');
  } finally {
    await closeServer(server);
    t.end();
  }
});
