const fs = require('fs');
const { execSync } = require('child_process');

console.log('[TestAgent] 🤖 AI 模拟器启动...\n');

console.log('[TestAgent] 📖 尝试读取 /etc/passwd...');
try {
    const content = fs.readFileSync('/etc/passwd', 'utf8');
    console.log('[TestAgent] ✅ 读取成功 (用户已允许)');
    console.log('[TestAgent] 内容预览:', content.substring(0, 100), '...\n');
} catch (error) {
    console.log('[TestAgent] ❌ 读取被拒绝:', error.message, '\n');
}

console.log('[TestAgent] 🗑️ 尝试执行: rm -rf /tmp/test');
try {
    execSync('rm -rf /tmp/test');
    console.log('[TestAgent] ✅ 命令执行成功 (用户已允许)\n');
} catch (error) {
    console.log('[TestAgent] ❌ 命令执行被拒绝:', error.message, '\n');
}

console.log('[TestAgent] 📖 尝试读取 ~/.ssh/id_rsa...');
try {
    const content = fs.readFileSync(process.env.HOME + '/.ssh/id_rsa', 'utf8');
    console.log('[TestAgent] ✅ 读取成功 (用户已允许)');
} catch (error) {
    console.log('[TestAgent] ❌ 读取被拒绝:', error.message, '\n');
}

console.log('[TestAgent] 👋 测试完成');
