import { VirtualClockControl } from '@features/controlVirtualClock';

export function AdminVirtualClockPage() {
    return (
        <div className="flex flex-col gap-6 pr-4 pb-10 md:pr-10">
            <VirtualClockControl />
        </div>
    );
}
