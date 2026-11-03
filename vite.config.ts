import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { devApiPlugin } from './server/devApiPlugin';

export default defineConfig(({ mode }) => {
  // 세 번째 인자 '' → 접두사 없는 변수까지 읽음. 서버 플러그인에만 전달하고 클라이언트에는 노출하지 않는다.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      devApiPlugin({
        KAKAO_REST_API_KEY: env.KAKAO_REST_API_KEY,
        VWORLD_API_KEY: env.VWORLD_API_KEY,
        VWORLD_DOMAIN: env.VWORLD_DOMAIN,
      }),
    ],
    worker: { format: 'es' },
  };
});
