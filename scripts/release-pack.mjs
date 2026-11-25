// Упаковывает публикуемые пакеты в .release/*.tgz — ровно то, что уйдёт в npm.
// Публикуем именно эти архивы (`npm publish .release/<file>.tgz`), чтобы проверенное и
// опубликованное совпадало байт в байт. Запуск: `pnpm release:pack` (сначала собирает всё).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, '.release');
// Порядок важен: ядро публикуется первым, обёртки от него зависят.
const PACKAGES = ['core', 'collab', 'react', 'vue', 'web-component', 'angular', 'tinymce-compat'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);

const versions = new Set();
for (const name of PACKAGES) {
  const dir = join(root, 'packages', name);
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  versions.add(manifest.version);
  // Несобранный пакет — понятная ошибка (иначе npm pack падает невнятным ENOENT).
  const built = name === 'angular' ? join(dir, 'dist', 'package.json') : join(dir, 'dist');
  if (!existsSync(built)) throw new Error(`${name}: нет ${built} — пакет не собран (pnpm build)`);
  if (name === 'angular') {
    // ng-packagr публикуется из dist (package.json там уже с настоящими версиями).
    execFileSync('npm', ['pack', '--pack-destination', out], {
      cwd: join(dir, 'dist'),
      shell: true,
      stdio: 'pipe',
    });
  } else {
    // pnpm pack заменяет workspace:^ на настоящие версии.
    execFileSync('pnpm', ['pack', '--pack-destination', out], {
      cwd: dir,
      shell: true,
      stdio: 'pipe',
    });
  }
}

if (versions.size !== 1) throw new Error(`Версии пакетов разошлись: ${[...versions].join(', ')}`);

const files = readdirSync(out).filter((f) => f.endsWith('.tgz'));
for (const file of files) {
  const manifest = execFileSync('tar', ['-xzOf', file, 'package/package.json'], {
    cwd: out,
  }).toString();
  if (manifest.includes('workspace:'))
    throw new Error(`${file}: в зависимостях остался workspace:`);
  if (/"private":\s*true/.test(manifest)) throw new Error(`${file}: пакет помечен private`);
}
const ordered = PACKAGES.map((name) => files.find((f) => f.startsWith(`novaprose-${name}-`)));
console.log(`Версия ${[...versions][0]}. Архивы в .release/ (публиковать в этом порядке):`);
for (const file of ordered) console.log(`  ${file}`);
