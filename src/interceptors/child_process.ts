import * as nodeModule from 'node:module';
import { askPermission } from '../worker/client';
import { isDangerousCommand } from '../utils/rules';

let originalChildProcess: any = null;
let hookInstalled = false;

function installHooks(): void {
  if (hookInstalled) return;
  hookInstalled = true;
  
  const originalRequire = (nodeModule as any).prototype.require;

  (nodeModule as any).prototype.require = function (...args: any[]) {
    const result = originalRequire.apply(this, args);
    const id = args[0];
    
    if ((id === 'child_process' || id === 'node:child_process') && !originalChildProcess) {
      originalChildProcess = { ...result };
      return createPatchedChildProcess(result);
    }
    
    return result;
  };

  console.log('[AgentUAC] 🔌 Module require hook 已安装 (child_process)');
}

function createPatchedChildProcess(cpModule: any): any {
  const patched = { ...cpModule };

  patched.exec = function (command: string, options?: any, callback?: any) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    if (isDangerousCommand(command)) {
      console.warn(`[AgentUAC] 🚨 拦截到危险命令执行: ${command}`);
      
      const isApproved = askPermission('EXEC_COMMAND', command);
      
      if (!isApproved) {
        throw new Error(`[AgentUAC] Permission Denied: 操作已被用户拦截`);
      }
    }

    return originalChildProcess.exec.apply(this, arguments as any);
  };

  patched.execSync = function (command: string, options?: any) {
    if (isDangerousCommand(command)) {
      console.warn(`[AgentUAC] 🚨 拦截到危险命令执行: ${command}`);
      
      const isApproved = askPermission('EXEC_COMMAND', command);
      
      if (!isApproved) {
        throw new Error(`[AgentUAC] Permission Denied: 操作已被用户拦截`);
      }
    }

    return originalChildProcess.execSync.apply(this, arguments as any);
  };

  patched.spawn = function (command: string, args?: any, options?: any) {
    const fullCommand = args ? `${command} ${args.join(' ')}` : command;
    
    if (isDangerousCommand(fullCommand)) {
      console.warn(`[AgentUAC] 🚨 拦截到危险命令执行: ${fullCommand}`);
      
      const isApproved = askPermission('SPAWN_COMMAND', fullCommand);
      
      if (!isApproved) {
        throw new Error(`[AgentUAC] Permission Denied: 操作已被用户拦截`);
      }
    }

    return originalChildProcess.spawn.apply(this, arguments as any);
  };

  patched.spawnSync = function (command: string, args?: any, options?: any) {
    const fullCommand = args ? `${command} ${args.join(' ')}` : command;
    
    if (isDangerousCommand(fullCommand)) {
      console.warn(`[AgentUAC] 🚨 拦截到危险命令执行: ${fullCommand}`);
      
      const isApproved = askPermission('SPAWN_COMMAND', fullCommand);
      
      if (!isApproved) {
        throw new Error(`[AgentUAC] Permission Denied: 操作已被用户拦截`);
      }
    }

    return originalChildProcess.spawnSync.apply(this, arguments as any);
  };

  return patched;
}

export function patchChildProcess(): void {
  installHooks();
  console.log('[AgentUAC] 🔒 Child Process 拦截器已挂载');
}
