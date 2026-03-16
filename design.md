

---

# 🚀 AgentUAC 项目开发文档 (Vibecoding Prompt)

## 一、 项目概述 (Project Overview)
*   **项目名称**: AgentUAC (User Account Control for AI)
*   **定位**: 为本地 AI 智能体（如 OpenClaw, AutoGPT, LangChain 应用）提供**零侵入、跨框架的运行时安全拦截与审批层**。
*   **核心痛点**: 解决本地 AI 拥有宿主“上帝权限”后，因代码逻辑错误或 Prompt Injection（提示词注入）导致的高危操作（如 `rm -rf`，读取 `~/.ssh/id_rsa`，反弹 Shell 等）。
*   **产品形态**: 
    1. **全局 CLI 工具**: 提供 `uac run <command>` 命令，通过环境变量注入拦截器。
    2. **NPM 模块**: 提供 `require('agent-uac/register')` 供开发者直接在代码中引入。

## 二、 系统架构设计 (System Architecture)

系统分为三个核心生命周期层：

1.  **CLI 包装层 (The Wrapper)**
    *   负责接收用户命令，将 `agent-uac/register` 模块路径注入到 `NODE_OPTIONS` 环境变量中，然后拉起目标进程（如 OpenClaw）。
2.  **运行时劫持层 (Runtime Monkey Patch Layer - 主线程)**
    *   在目标 Node.js 应用的业务代码执行前（Preload 阶段）运行。
    *   劫持 Node.js 核心模块：`child_process` (拦截执行) 和 `fs` (拦截敏感文件读写)。
    *   包含**风险扫描引擎**（简单的正则黑名单匹配）。
3.  **异步通信与阻塞层 (Worker & Network Layer - 子线程)**
    *   主线程一旦捕获到高危操作，通过 `SharedArrayBuffer` 和 `Worker Threads` 将上下文传给独立的子线程。
    *   **主线程**调用 `Atomics.wait` 进入系统级休眠，**完全不阻塞 Node.js Event Loop 中的其他无关操作**。
    *   **子线程**负责与外部（如 Telegram Bot API 或 Cloudflare Worker 网关）进行长连接通信，等待用户点击【允许/拒绝】。
    *   用户决策返回后，子线程修改共享内存，主线程苏醒并执行放行或阻断逻辑。

## 三、 技术栈选型 (Tech Stack)

*   **语言**: TypeScript (编译为无依赖的纯 CommonJS/ESM 代码，确保极佳的兼容性)。
*   **核心模块**: `node:child_process`, `node:fs`, `node:worker_threads`, `node:url`。
*   **CLI 构建**: `commander` (极简的命令行参数解析)。
*   **配置管理**: 读取 `~/.agent-uac/config.json`（存储 Telegram Bot Token 或 Chat ID）。

## 四、 核心目录结构规划

```text
agent-uac/
├── package.json
├── bin/
│   └── uac.js                 # CLI 入口 (解析 uac run ...)
├── src/
│   ├── register.ts            # Preload 入口 (被 --require 引入)
│   ├── config.ts              # 策略与配置加载
│   ├── interceptors/          # 核心劫持逻辑
│   │   ├── child_process.ts   # 劫持 exec, spawn, execSync
│   │   └── fs.ts              # 劫持 readFileSync, unlink 等
│   ├── worker/
│   │   └── notify-worker.ts   # 独立子线程: 负责与 Telegram 交互并操作 Atomics
│   └── utils/
│       └── rules.ts           # 危险命令/路径正则匹配库
└── tsconfig.json
```

## 五、 关键技术实现指导 (给 AI 的重点实现要求)

> **⚠️ 致 Vibecoding AI 助手的特别提示**: 
> 本项目的难点在于**拦截同步 API（如 `fs.readFileSync`, `child_process.execSync`）时不能使用 `while(true)` 死循环或强制转为异步 Promise，否则会破坏原应用的同步执行逻辑或锁死 Event Loop。必须严格使用 `SharedArrayBuffer` + `Atomics.wait` 机制！**

### 1. 核心接口设计：同步阻塞拦截器 (Synchronous Blocker)

请实现一个通用的函数 `askPermissionSync(actionType, target)`：
*   **输入**: 动作类型（如 `'READ_FILE'`），目标（如 `'~/.ssh/id_rsa'`）。
*   **输出**: 布尔值 (`true` 允许, `false` 拒绝)。
*   **内部逻辑**:
    1. 初始化一个 `SharedArrayBuffer(4)`，并转为 `Int32Array`（初始值为 0：等待中）。
    2. 将请求详情及共享内存引用发送给全局初始化的 Worker Thread (`notify-worker.ts`)。
    3. 主线程调用 `Atomics.wait(int32Array, 0, 0)` 挂起。
    4. 线程苏醒后，读取 `int32Array[0]` 的值（1 为允许，2 为拒绝）。

### 2. 关键代码段参考 (Code Snippets for Reference)

#### A. CLI 包装器 (bin/uac.js)
```javascript
#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// 捕获用户输入的命令，例如: uac run "node openclaw.js"
const args = process.argv.slice(2);
if (args[0] === 'run') {
    const targetCmd = args.slice(1).join(' ');
    
    // 注入 --require 环境变量
    const registerPath = path.resolve(__dirname, '../dist/register.js');
    const env = {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require "${registerPath}"`
    };

    console.log(`[AgentUAC] 🛡️ 启动安全沙箱拦截模式...`);
    spawn(targetCmd, { env, stdio: 'inherit', shell: true });
}
```

#### B. 运行时劫持入口 (src/register.ts)
```typescript
import { patchChildProcess } from './interceptors/child_process';
import { patchFS } from './interceptors/fs';

console.log('[AgentUAC] 🟢 安全内核已挂载，监控 AI 危险操作中...');

// 初始化时立刻劫持目标 API
patchChildProcess();
patchFS();
```

#### C. 同步 API 的劫持示例 (src/interceptors/fs.ts)
```typescript
import fs from 'node:fs';
import { askPermissionSync } from '../worker/client';
import { isDangerousPath } from '../utils/rules';

export function patchFS() {
    const originalReadFileSync = fs.readFileSync;

    // 覆盖原函数
    (fs as any).readFileSync = function (path: string, options: any) {
        if (isDangerousPath(path)) {
            console.warn(`[AgentUAC] 🚨 拦截到敏感文件读取: ${path}`);
            
            // 调用基于 Atomics 的同步阻塞查询
            const isApproved = askPermissionSync('READ_FILE', path);
            
            if (!isApproved) {
                // 用户拒绝，抛出异常让 AI 捕获，但不崩溃 Node.js
                throw new Error(`[AgentUAC] EACCES: permission denied, open '${path}'`);
            }
        }
        // 用户允许或安全路径，调用原生方法
        return originalReadFileSync.apply(this, arguments);
    };
}
```

#### D. 子线程通信逻辑 (src/worker/notify-worker.ts)
```typescript
import { parentPort } from 'node:worker_threads';
// 假设这里引入了一个向 Telegram 发送消息并轮询结果的函数
import { sendTelegramAlertAndWait } from '../utils/telegram';

parentPort?.on('message', async (msg) => {
    if (msg.type === 'ASK_PERMISSION') {
        const { action, target, sharedBuffer } = msg;
        const int32Array = new Int32Array(sharedBuffer);

        try {
            // 异步调用外部网络请求 (不阻塞子线程)
            const approved = await sendTelegramAlertAndWait(action, target);
            
            // 修改共享内存状态
            int32Array[0] = approved ? 1 : 2;
            
            // 唤醒主线程 ✨
            Atomics.notify(int32Array, 0, 1);
        } catch (error) {
            // 网络异常默认拒绝
            int32Array[0] = 2;
            Atomics.notify(int32Array, 0, 1);
        }
    }
});
```

## 六、 开发第一阶段 (Phase 1 MVP) 验证目标

请 AI 助手首先完成以下 MVP 闭环：
1.  搭建 TypeScript 编译环境和基础目录。
2.  实现 CLI 能够成功使用 `--require` 拉起一个测试用的 `test-agent.js`。
3.  在 `test-agent.js` 中模拟 AI 执行 `fs.readFileSync('/etc/passwd')` 和 `child_process.execSync('rm -rf /tmp/test')`。
4.  实现 `Atomics.wait` 机制，能在终端中模拟暂停，并等待几秒钟（模拟网络请求返回）后打印拦截或放行结果。
5.  *暂不需要实现真实的 Telegram API，使用 `setTimeout` 模拟子线程的网络延迟和用户随机点击（50%通过，50%拒绝）即可。*

---