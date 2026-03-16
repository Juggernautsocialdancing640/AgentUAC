import * as os from 'node:os';
import * as path from 'node:path';
import { config } from '../config';

function expandTilde(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

export function isDangerousPath(filepath: string): boolean {
  const expandedPath = expandTilde(filepath);
  const normalizedPath = path.normalize(expandedPath);

  for (const pattern of config.dangerousPaths) {
    const expandedPattern = expandTilde(pattern);
    const normalizedPattern = path.normalize(expandedPattern);
    
    if (normalizedPath.includes(normalizedPattern)) {
      return true;
    }

    const regex = new RegExp(normalizedPattern.replace(/\//g, '\\/'), 'i');
    if (regex.test(normalizedPath)) {
      return true;
    }
  }

  return false;
}

export function isDangerousCommand(command: string): boolean {
  for (const pattern of config.dangerousCommands) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(command)) {
      return true;
    }
  }

  return false;
}
