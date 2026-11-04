// 에러 바운더리 — 3D 씬 등 하위 컴포넌트의 렌더링 오류가 앱 전체를 멈추지 않게 한다.
// React는 에러 바운더리를 Hooks로 만들 수 있는 API(componentDidCatch 대응)를 제공하지 않으므로
// 이 컴포넌트만 예외적으로 클래스 컴포넌트로 작성한다.
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** 오류 메시지 앞에 붙는 영역 이름 (예: '3D 장면') */
  scope: string;
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** 이 값이 바뀌면 오류 상태를 초기화한다 (예: 새 검색) */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.scope}] 렌더링 오류`, error, info.componentStack);
  }

  override componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  reset = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div role="alert" style={{ padding: 16 }}>
        <p>{this.props.scope}에서 오류가 발생했습니다.</p>
        <button type="button" onClick={this.reset}>
          다시 시도
        </button>
      </div>
    );
  }
}
