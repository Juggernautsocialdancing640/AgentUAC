import * as nodeModule from 'node:module';
import { askPermission } from '../worker/client';
import { isDangerousPath } from '../utils/rules';

let originalFs: any = null;
let hookInstalled = false;

function installHooks(): void {
  if (hookInstalled) return;
  hookInstalled = true;
  
  const originalRequire = (nodeModule as any).prototype.require;

  (nodeModule as any).prototype.require = function (...args: any[]) {
    const result = originalRequire.apply(this, args);
    const id = args[0];
    
    if ((id === 'fs' || id === 'node:fs') && !originalFs) {
      originalFs = { ...result };
      return createPatchedFS(result);
    }
    
    return result;
  };

  console.log('[AgentUAC] 🔌 Module require hook 已安装');
}

function createPatchedFS(fsModule: any): any {
  const patchedFs = { ...fsModule };
  
  patchedFs.readFileSync = function (...args: any[]) {
    const path = args[0];
    if (isDangerousPath(path)) {
      console.warn(`[AgentUAC] 🚨 拦截到敏感文件读取: ${path}`);
      const isApproved = askPermission('READ_FILE', path);
      if (!isApproved) {
        throw new Error(`[AgentUAC] Permission Denied: 操作已被用户拦截`);
      }
    }
    return originalFs.readFileSync.apply(this, args);
  };

  patchedFs.writeFileSync = function (...args: any[]) {
    const path = args[0];
    if (isDangerousPath(path)) {
      console.warn(`[AgentUAC] 🚨 拦截到敏感文件写入: ${path}`);
      const isApproved = askPermission('WRITE_FILE', path);
      if (!isApproved) {
        throw new Error(`[AgentUAC] Permission Denied: 操作已被用户拦截`);
      }
    }
    return originalFs.writeFileSync.apply(this, args);
  };

  patchedFs.unlinkSync = function (...args: any[]) {
    const path = args[0];
    if (isDangerousPath(path)) {
      console.warn(`[AgentUAC] 🚨 拦截到敏感文件删除: ${path}`);
      const isApproved = askPermission('DELETE_FILE', path);
      if (!isApproved) {
        throw new Error(`[AgentUAC] EACCES: permission denied, unlink '${path}'`);
      }
    }
    return originalFs.unlinkSync.apply(this, args);
  };

  patchedFs.rmSync = function (...args: any[]) {
    const path = args[0];
    if (isDangerousPath(path)) {
      console.warn(`[AgentUAC] 🚨 拦截到敏感文件删除: ${path}`);
      const isApproved = askPermission('DELETE_FILE', path);
      if (!isApproved) {
        throw new Error(`[AgentUAC] EACCES: permission denied, rm '${path}'`);
      }
    }
    return originalFs.rmSync.apply(this, args);
  };

  patchedFs.rmdirSync = function (...args: any[]) {
    const path = args[0];
    if (isDangerousPath(path)) {
      console.warn(`[AgentUAC] 🚨 拦截到敏感目录删除: ${path}`);
      const isApproved = askPermission('DELETE_DIR', path);
      if (!isApproved) {
        throw new Error(`[AgentUAC] EACCES: permission denied, rmdir '${path}'`);
      }
    }
    return originalFs.rmdirSync.apply(this, args);
  };

  patchedFs.mkdirSync = function (...args: any[]) {
    const path = args[0];
    if (isDangerousPath(path)) {
      console.warn(`[AgentUAC] 🚨 拦截到敏感目录创建: ${path}`);
      const isApproved = askPermission('CREATE_DIR', path);
      if (!isApproved) {
        throw new Error(`[AgentUAC] EACCES: permission denied, mkdir '${path}'`);
      }
    }
    return originalFs.mkdirSync.apply(this, args);
  };

  return patchedFs;
}

export function patchFS(): void {
  installHooks();
  console.log('[AgentUAC] 🔒 FS 拦截器已挂载');
}
