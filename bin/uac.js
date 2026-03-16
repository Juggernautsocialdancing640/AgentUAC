#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

if (args[0] === 'run') {
    const targetCmd = args.slice(1).join(' ');
    
    const preloadPath = path.resolve(__dirname, '../dist/register.js');
    const env = {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require "${preloadPath}"`
    };

    console.log(`[AgentUAC] 🛡️ 启动安全沙箱拦截模式...`);
    console.log(`[AgentUAC] 📝 执行命令: ${targetCmd}`);
    
    spawn(targetCmd, { env, stdio: 'inherit', shell: true });
} else if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
AgentUAC - User Account Control for AI

Usage:
  uac run <command>    Run command with security interception
  uac --help          Show this help message

Example:
  uac run "node my-agent.js"
  uac run "npm start"
    `.trim());
} else {
    console.log('Usage: uac run <command>');
    console.log('Type uac --help for more information');
}
