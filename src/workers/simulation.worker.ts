// 일조 계산 Worker 진입점 — 메인 스레드를 막지 않고 광선 계산을 수행한다 (PLAN.md 10장)
/// <reference lib="webworker" />
import type { FromWorker, ToWorker } from './protocol';
import { createWorkerRuntime } from './workerRuntime';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const runtime = createWorkerRuntime((message: FromWorker, transfer?: Transferable[]) =>
  ctx.postMessage(message, transfer ?? []),
);

ctx.onmessage = (event: MessageEvent<ToWorker>) => {
  void runtime.handle(event.data);
};
