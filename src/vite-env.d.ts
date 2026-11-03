/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 비밀 값이 아닌 클라이언트 플래그만 VITE_ 접두사를 사용한다 */
  readonly VITE_FORCE_SAMPLE_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
