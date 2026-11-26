// Packs the publishable packages into .release/*.tgz: exactly what goes to npm.
// These very archives get published (`npm publish .release/<file>.tgz`), so that what was checked and
// what was published match byte for byte. Run: `pnpm release:pack` (builds everything first).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, '.release');
// The order matters: the core is published first, the wrappers depend on it.
const PACKAGES = ['core', 'collab', 'react', 'vue', 'web-component', 'angular', 'tinymce-compat'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);

const versions = new Set();
for (const name of PACKAGES) {
  const dir = join(root, 'packages', name);
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  versions.add(manifest.version);
  // An unbuilt package gets a clear error (otherwise npm pack fails with a vague ENOENT).
  const built = name === 'angular' ? join(dir, 'dist', 'package.json') : join(dir, 'dist');
  if (!existsSync(built))
    throw new Error(`${name}: no ${built}, the package isn't built (pnpm build)`);
  if (name === 'angular') {
    // ng-packagr packages are published from dist (package.json there already has real versions).
    execFileSync('npm', ['pack', '--pack-destination', out], {
      cwd: join(dir, 'dist'),
      shell: true,
      stdio: 'pipe',
    });
  } else {
    // pnpm pack replaces workspace:^ with the real versions.
    execFileSync('pnpm', ['pack', '--pack-destination', out], {
      cwd: dir,
      shell: true,
      stdio: 'pipe',
    });
  }
}

if (versions.size !== 1) throw new Error(`Package versions differ: ${[...versions].join(', ')}`);

const files = readdirSync(out).filter((f) => f.endsWith('.tgz'));
for (const file of files) {
  const manifest = execFileSync('tar', ['-xzOf', file, 'package/package.json'], {
    cwd: out,
  }).toString();
  if (manifest.includes('workspace:'))
    throw new Error(`${file}: a workspace: range is left in the dependencies`);
  if (/"private":\s*true/.test(manifest)) throw new Error(`${file}: the package is marked private`);
}
const ordered = PACKAGES.map((name) => files.find((f) => f.startsWith(`novaprose-${name}-`)));
console.log(`Version ${[...versions][0]}. Archives in .release/ (publish in this order):`);
for (const file of ordered) console.log(`  ${file}`);
