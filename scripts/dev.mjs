import { createServer } from 'node:http';
import worker from '../.build/worker.mjs';

const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://localhost:${port}`);
    const result = await worker.fetch(new Request(url, { method: request.method }));
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    console.error(error);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Local server error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Manifesto available at http://127.0.0.1:${port}/`);
});
