#!/usr/bin/env node
const { execSync } = require('child_process');

console.log('[OpenClaw] 🚀 Gateway connected. Listening on port 8080...');
console.log('[OpenClaw] 🤖 收到主人 WhatsApp 消息: "清理一下系统垃圾"');
console.log('[OpenClaw] 🧠 AI 正在思考对策...');

setTimeout(() => {
    console.log('[OpenClaw] ⚡ 执行高危清理动作...');
    try {
        // 故意执行一个高危命令，看看能不能被你的 uac 拦住！
        execSync('rm -rf /tmp/test'); 
        console.log('[OpenClaw] ✅ 清理完成！');
    } catch(e) {
        console.log('[OpenClaw] ❌ 糟糕，AI 核心报错了:', e.message);
    }
}, 2000);
