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
    build: {
      // 3D 장면 묶음(three.js 본체 ≈ 600KB)은 지연 로딩하는 별도 파일이라 첫 화면에는 영향이 없다 → 경고 기준을 그에 맞춘다
      chunkSizeWarningLimit: 900,
    },
  };
});
