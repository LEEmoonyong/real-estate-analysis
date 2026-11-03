// Vite dev 서버에 /api/* 를 연결하는 플러그인.
// Vercel 함수와 같은 router를 사용해 로컬과 배포 환경 동작을 일치시킨다.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { ServerEnv } from './http';
import { routeApi } from './router';

export function devApiPlugin(env: ServerEnv): Plugin {
  return {
    name: 'sunsim-dev-api',
    configureServer(server) {
      server.middlewares.use('/api', (req: IncomingMessage, res: ServerResponse) => {
        const url = `http://localhost${req.originalUrl ?? req.url ?? '/api'}`;
        const request = new Request(url, { method: req.method ?? 'GET' });
        routeApi(request, env)
          .then(async (response) => {
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            res.end(Buffer.from(await response.arrayBuffer()));
          })
          .catch((err: unknown) => {
            res.statusCode = 500;
            res.end(String(err));
          });
      });
    },
  };
}

declare module 'node:http' {
  interface IncomingMessage {
    originalUrl?: string;
  }
}
