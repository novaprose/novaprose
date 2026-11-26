// ng-packagr copies package.json into dist as is, with `workspace:^`. The package is published from dist,
// so the real dependency versions from the workspace are filled in here.
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
