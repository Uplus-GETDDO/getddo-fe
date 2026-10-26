import emptyTakko from '@shared/assets/mascot/empty-takko.png';
import { cn } from '@shared/utils/cn';

/**
 * 이미지가 없거나 열리지 않을 때의 자리 — 회색 칸 가운데에 빈 상태 캐릭터(EmptyState와 같은 그림)를 둔다.
 * 빈 회색 칸만 두면 로딩 중인지 그림이 없는 건지 구분되지 않는다. 칸 크기·비율·모서리는 부모가 className으로 정하고,
 * 캐릭터는 칸 너비의 60%(최대 160px)로 맞춰 작은 목록 썸네일부터 큰 상품 칸까지 같은 꼴로 보이게 한다
 */
function ImagePlaceholder({ className }: { className?: string }) {
    return (
        <div className={cn('bg-surface-sunken flex items-center justify-center', className)}>
            <img src={emptyTakko} alt="" aria-hidden className="w-[60%] max-w-40 object-contain" />
        </div>
    );
}

export { ImagePlaceholder };
