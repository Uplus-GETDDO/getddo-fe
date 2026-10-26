import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { collectInitial, measureAssets, visit } from './lib/bundleGraph.mjs';

const root = resolve(process.argv[3] ?? 'dist');
const initial = collectInitial(root);
const files = measureAssets(root, initial);
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
    // 초기 그래프만 캐시됐을 때 필요한 페이지·공유 청크 합계다. 실제 전환에서는 이미 받은 청크만큼 작아진다.
    routeChunks: files
        .filter((file) =>
            /^(EventListPage|EventDetailPage|TimeRafflePage|TimeRaffleDetailPage|MissionListPage|MissionDetailPage|GameDetailPage|MyTicketsPage|MyEntriesPage|MyNotificationsPage|MyPage)-.*\.js$/.test(
                file.file,
            ),
        )
        .map((entry) => {
            const reachable = new Set();
            visit(join(root, 'assets', entry.file), reachable);
            const incremental = files.filter(
                (file) =>
                    !file.initial &&
                    file.file.endsWith('.js') &&
                    reachable.has(join(root, 'assets', file.file)),
            );
            return {
                entry: entry.file,
                files: incremental.map((file) => file.file),
                ...sum(incremental),
            };
        }),
    files,
};
writeFileSync(process.argv[2] ?? 'reports/GD-262/bundle.json', JSON.stringify(result, null, 2));
process.stdout.write(
    JSON.stringify({ initialJs: result.initialJs, initialCss: result.initialCss }) + '\n',
);
