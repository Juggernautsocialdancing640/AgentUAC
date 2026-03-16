import { Worker } from 'node:worker_threads';
import * as path from 'node:path';

let worker: Worker | null = null;
let workerReady = false;
let initDone = false;

function initWorker(): void {
  if (initDone) return;
  initDone = true;

  const workerPath = path.join(__dirname, 'notify-worker.js');
  worker = new Worker(workerPath, {
    env: { ...process.env, NODE_WORKER: 'true' }
  });

  worker.on('online', () => {
    workerReady = true;
    console.log('[AgentUAC] ✅ Worker 线程已就绪');
  });

  worker.on('error', (err) => {
    console.error('[AgentUAC] ❌ Worker 线程错误:', err);
    workerReady = false;
  });
}

export function askPermission(actionType: string, target: string): boolean {
  if (!initDone) {
    initWorker();
  }

  if (!worker) {
    console.log('[AgentUAC] ⚠️ Worker 未创建，默认拒绝');
    return false;
  }

  const sharedBuffer = new SharedArrayBuffer(4);
  const int32Array = new Int32Array(sharedBuffer);
  int32Array[0] = 0;

  worker.postMessage({
    type: 'ASK_PERMISSION',
    action: actionType,
    target: target,
    sharedBuffer: sharedBuffer,
  });

  console.log(`[AgentUAC] 🛑 主线程即将进入 Atomics.wait 休眠...`);

  const waitStatus = Atomics.wait(int32Array, 0, 0);

  console.log(`[AgentUAC] 🟢 主线程被唤醒！waitStatus: ${waitStatus}, 内存值: ${int32Array[0]}`);

  if (int32Array[0] === 2) {
    return false;
  }
  return true;
}

export function cleanup(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    workerReady = false;
  }
}