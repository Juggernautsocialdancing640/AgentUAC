import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface UACConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
  timeout?: number;
  dangerousPaths: string[];
  dangerousCommands: string[];
}

const DEFAULT_CONFIG: UACConfig = {
  dangerousPaths: [
    '/etc/passwd',
    '/etc/shadow',
    '/etc/sudoers',
    '/root/.ssh',
    '/home/.ssh',
    '~/.ssh',
    '~/.aws',
    '/etc/kubernetes',
    '/etc/docker',
  ],
  dangerousCommands: [
    'rm -rf',
    'rm -r /',
    'dd if=',
    'mkfs',
    '>:',
    '> /',
    'chmod 777',
    'chown -R',
    'wget.*\|',
    'curl.*\|',
    'nc -e',
    '/bin/sh -i',
    'pkill -9',
    'kill -9',
  ],
};

export function loadConfig(): UACConfig {
  const configDir = path.join(os.homedir(), '.agent-uac');
  const configPath = path.join(configDir, 'config.json');

  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch {
      console.warn('[AgentUAC] ⚠️ 配置文件解析失败，使用默认配置');
    }
  }

  return DEFAULT_CONFIG;
}

export const config = loadConfig();
