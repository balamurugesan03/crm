// Builds the client for production (/crm/ base) and packs a release tarball:
//   node deploy/package-release.mjs      ->  release/nexuscrm-<timestamp>.tar.gz
// Contents: server source + lockfile (deps installed on the server), client/dist, deploy/ files.
// Never includes node_modules, .env files or uploads.
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

console.log('> Building client (base /crm/) ...');
run('npm run build', path.join(root, 'client'));

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const outDir = path.join(root, 'release');
const stage = path.join(outDir, `nexuscrm-${stamp}`);
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

const copy = (from, to) => fs.cpSync(path.join(root, from), path.join(stage, to || from), {
  recursive: true,
  filter: (src) => !/node_modules|[\/]uploads([\/]|$)|[\/]\.env($|\.(?!example|production\.example))/.test(src),
});
copy('server/src');
copy('server/package.json');
copy('server/package-lock.json');
copy('server/.env.production.example');
copy('client/dist', 'client');
copy('deploy');
copy('README.md');

const tarball = path.join(outDir, `nexuscrm-${stamp}.tar.gz`);
run(`tar -czf "${path.basename(tarball)}" "${path.basename(stage)}"`, outDir);
fs.rmSync(stage, { recursive: true, force: true });
console.log(`\n✔ Release ready: ${path.relative(root, tarball)}\n  Upload it to the server and run: bash deploy/update.sh <tarball>  (see deploy/DEPLOY.md)`);
