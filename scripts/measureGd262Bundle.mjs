import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import ts from 'typescript';

// 생성된 ESM 청크의 정적 의존성만 따라가며 dynamic import는 초기 비용에서 제외한다.
const root = resolve(process.argv[3] ?? 'dist');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const roots = [...html.matchAll(/(?:src|href)="([^"?]+\.(?:js|css))"/g)].map((m) =>
    join(root, m[1].replace(/^\//, '')),
);
const initial = new Set();
function visit(file) {
    if (initial.has(file)) return;
    initial.add(file);
    if (!file.endsWith('.js')) return;
    const source = readFileSync(file, 'utf8');
    const parsed = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.JS,
    );
    for (const statement of parsed.statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        const specifier = statement.moduleSpecifier;
        if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
            visit(resolve(dirname(file), specifier.text));
        }
    }
}
roots.forEach(visit);
const files = readdirSync(join(root, 'assets'))
    .filter((name) => statSync(join(root, 'assets', name)).isFile())
    .map((name) => {
        const file = join(root, 'assets', name);
        const bytes = readFileSync(file);
        return {
            file: basename(file),
            initial: initial.has(file),
            raw: bytes.length,
            gzip: gzipSync(bytes).length,
            brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
                .length,
        };
    });
const sum = (items) =>
    Object.fromEntries(
        ['raw', 'gzip', 'brotli'].map((key) => [
            key,
            items.reduce((total, file) => total + file[key], 0),
        ]),
    );
const result = {
    kind: 'dist 정적 그래프',
    compression: { gzipLevel: '기본', brotliQuality: 5 },
    initialJs: sum(files.filter((f) => f.initial && f.file.endsWith('.js'))),
    initialCss: sum(files.filter((f) => f.initial && f.file.endsWith('.css'))),
    total: sum(files),
    files,
};
writeFileSync(process.argv[2] ?? 'reports/GD-262/bundle.json', JSON.stringify(result, null, 2));
process.stdout.write(
    JSON.stringify({ initialJs: result.initialJs, initialCss: result.initialCss }) + '\n',
);
