import { describe, expect, it } from 'vitest';
import { resolveApiHealth, shouldTryRemote } from './useApiHealth';

describe('데이터 경로 결정 (로컬 키 → 배포 서버 → 샘플)', () => {
  it('같은 서버에 키가 있으면 그대로 사용', () => {
    expect(resolveApiHealth({ kakao: true, vworld: true }, null)).toMatchObject({ mode: 'live', route: 'local' });
  });

  it('로컬에 키가 없으면 배포 서버를 빌려 쓴다', () => {
    expect(resolveApiHealth({ kakao: false, vworld: false }, { kakao: true, vworld: true })).toMatchObject({
      mode: 'live',
      route: 'remote',
      keys: { kakao: true, vworld: true },
    });
    // /api가 아예 없는 정적 실행(npm run preview)도 같다
    expect(resolveApiHealth(null, { kakao: true })).toMatchObject({ mode: 'live', route: 'remote' });
  });

  it('둘 다 안 되면 샘플 모드와 이유', () => {
    const noKeys = resolveApiHealth({ kakao: false }, null);
    expect(noKeys).toMatchObject({ mode: 'sample', route: null });
    expect(noKeys.reason).toContain('배포 서버');
    expect(resolveApiHealth(null, null).reason).toContain('연결할 수 없어');
  });

  it('배포 사이트 자신이거나 설정으로 끈 경우에는 빌려 쓰지 않는다', () => {
    const base = 'https://sunlight-simulator-alpha.vercel.app';
    expect(shouldTryRemote(base, 'http://localhost:5173')).toBe(true);
    expect(shouldTryRemote(base, base)).toBe(false);
    expect(shouldTryRemote('', 'http://localhost:5173')).toBe(false);
  });
});
