// ng-packagr копирует package.json в dist как есть — с `workspace:^`. Публикуем пакет из dist,
// поэтому подставляем настоящие версии зависимостей из воркспейса.
import { readFileSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/package.json', import.meta.url);
const manifest = JSON.parse(readFileSync(dist, 'utf8'));
const versionOf = (name) => {
  const dir = name.replace('@novaprose/', '');
  return JSON.parse(readFileSync(new URL(`../../${dir}/package.json`, import.meta.url), 'utf8'))
    .version;
};
for (const field of ['dependencies', 'peerDependencies']) {
  for (const [dep, range] of Object.entries(manifest[field] ?? {})) {
    if (range.startsWith('workspace:')) manifest[field][dep] = `^${versionOf(dep)}`;
  }
}
delete manifest.publishConfig?.directory;
writeFileSync(dist, JSON.stringify(manifest, null, 2) + '\n');
console.log(`dist/package.json: ${manifest.name}@${manifest.version}`, manifest.dependencies);
