import { parentPort } from 'node:worker_threads';

interface AskPermissionMessage {
  type: 'ASK_PERMISSION';
  action: string;
  target: string;
  sharedBuffer: SharedArrayBuffer;
}

parentPort?.on('message', async (msg: AskPermissionMessage) => {
  if (msg.type === 'ASK_PERMISSION') {
    const { action, target, sharedBuffer } = msg;
    const int32Array = new Int32Array(sharedBuffer);
    const ALLOWED = 1;
    const DENIED = 2;

    console.log(`[Worker] 📨 收到审批请求: ${action} - ${target}`);

    try {
      const approved = await simulateUserDecision(action, target);
      
      int32Array[0] = approved ? ALLOWED : DENIED;
      
      const notifyCount = Atomics.notify(int32Array, 0, 1);
      console.log(`[Worker] 🔔 通知主线程 (结果: ${approved ? '允许' : '拒绝'}), notifyCount: ${notifyCount}`);
    } catch (error) {
      console.error('[Worker] ❌ 处理请求时出错:', error);
      int32Array[0] = 2;
      Atomics.notify(int32Array, 0, 1);
    }
  }
});

function simulateUserDecision(action: string, target: string): Promise<boolean> {
  return new Promise((resolve) => {
    const delay = 2000 + Math.random() * 3000;
    console.log(`[Worker] ⏳ 模拟网络请求... (${(delay / 1000).toFixed(1)}秒)`);
    
    setTimeout(() => {
      const approved = Math.random() > 0.5;
      console.log(`[Worker] 👤 用户决策: ${approved ? '允许' : '拒绝'}`);
      resolve(approved);
    }, delay);
  });
}
