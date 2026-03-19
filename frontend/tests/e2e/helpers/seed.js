import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');


export function seedScenario(scenario = 'full') {
  const customCommand = process.env.E2E_SEED_COMMAND;

  if (customCommand) {
    execSync(`${customCommand} --scenario ${scenario}`, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    return;
  }

  const python = process.env.PYTHON || 'python';
  const scriptPath = path.join(REPO_ROOT, 'backend', 'scripts', 'e2e_seed.py');

  execFileSync(python, [scriptPath, '--scenario', scenario], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}
