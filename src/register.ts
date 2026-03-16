import { patchChildProcess } from './interceptors/child_process';
import { patchFS } from './interceptors/fs';

let initialized = false;

if (!initialized) {
  initialized = true;
  
  const isWorker = process.env.NODE_WORKER === 'true';
  if (isWorker) {
    console.log('[AgentUAC] 👷 Worker 模式，跳过主拦截器初始化');
  } else {
    console.log('[AgentUAC] 🟢 安全内核已挂载，监控 AI 危险操作中...');
    
    require('child_process');
    require('fs');
    patchChildProcess();
    patchFS();
    console.log('[AgentUAC] ✅ 拦截器已就绪');
  }
}
