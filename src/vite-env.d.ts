/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 비밀 값이 아닌 클라이언트 플래그만 VITE_ 접두사를 사용한다 */
  readonly VITE_FORCE_SAMPLE_MODE?: string;
  /** 로컬에 키가 없을 때 빌려 쓰는 배포 서버 주소 (빈 값이면 사용 안 함) */
  readonly VITE_REMOTE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
