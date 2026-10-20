import { toast } from 'sonner';

import { Button } from '@shared/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@shared/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@shared/ui/dialog';
import { Input } from '@shared/ui/input';
import { Loading } from '@shared/ui/loading';
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@shared/ui/select';
import { Skeleton, SkeletonList } from '@shared/ui/skeleton';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@shared/ui/table';
import { Textarea } from '@shared/ui/textarea';

import { RewardDialogPreview } from './ui/RewardDialogPreview';

function Section({
    title,
    usage,
    children,
}: {
    title: string;
    usage: string;
    children: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3">
            <div>
                <h2 className="text-title-3">{title}</h2>
                <p className="text-body-sm text-fg-tertiary">{usage}</p>
            </div>
            <div className="border-border bg-surface-elevated rounded-xl border p-6">
                {children}
            </div>
        </section>
    );
}

export function UiGalleryPage() {
    return (
        <main className="mx-auto flex max-w-3xl flex-col gap-10 p-8">
            <div>
                <h1 className="text-title-1">UI 갤러리</h1>
                <p className="text-body-sm text-fg-secondary">
                    shared/ui 컴포넌트 미리보기 — 개발용 화면
                </p>
            </div>

            <Section
                title="Button"
                usage="모든 액션의 기본. variant(색·형태)와 size로 구분 — 응모하기, 확인, 삭제 등"
            >
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button>primary</Button>
                        <Button variant="secondary">secondary</Button>
                        <Button variant="ghost">ghost</Button>
                        <Button variant="destructive">destructive</Button>
                        <Button variant="link">link</Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm">sm</Button>
                        <Button>default</Button>
                        <Button size="lg">lg</Button>
                        <Button disabled>disabled</Button>
                    </div>
                </div>
            </Section>

            <Section
                title="Input"
                usage="한 줄 텍스트 입력 — 이벤트명, 검색어, 사유 입력 등 폼의 기본 단위"
            >
                <div className="flex max-w-sm flex-col gap-3">
                    <Input placeholder="이벤트 제목을 입력하세요" />
                    <Input placeholder="비활성 상태" disabled />
                    <Input defaultValue="잘못된 값" aria-invalid />
                </div>
            </Section>

            <Section
                title="Textarea"
                usage="여러 줄 텍스트 입력 — 설문 자유 서술 문항, 긴 사유 입력"
            >
                <div className="flex max-w-sm flex-col gap-3">
                    <Textarea placeholder="의견을 자유롭게 적어주세요" rows={4} />
                    <Textarea placeholder="비활성 상태" disabled />
                </div>
            </Section>

            <Section
                title="Radio Group"
                usage="하나만 고르는 선택지 — 미션 OX·객관식 문항처럼 보기가 항상 보이는 선택"
            >
                <RadioGroup defaultValue="opt-1" className="max-w-sm gap-2">
                    {[
                        { id: 'opt-1', label: '앱 푸시' },
                        { id: 'opt-2', label: '문자 메시지' },
                        { id: 'opt-3', label: '받지 않는다' },
                    ].map((option) => (
                        <label
                            key={option.id}
                            htmlFor={option.id}
                            className="border-border-default has-checked:border-primary has-checked:bg-brand-primary/10 flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
                        >
                            <RadioGroupItem id={option.id} value={option.id} />
                            <span className="text-body text-fg-primary">{option.label}</span>
                        </label>
                    ))}
                </RadioGroup>
            </Section>

            <Section
                title="Select"
                usage="정해진 선택지 중 하나를 고를 때 — 이벤트 상태 필터, 정렬 기준 등"
            >
                <Select>
                    <SelectTrigger className="w-56">
                        <SelectValue placeholder="이벤트 상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>상태</SelectLabel>
                            <SelectItem value="open">응모 가능</SelectItem>
                            <SelectItem value="closed">마감</SelectItem>
                            <SelectItem value="drawn">추첨 완료</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </Section>

            <Section title="Card" usage="관련 정보를 묶는 컨테이너 — 이벤트 카드, 요약 통계, 패널">
                <Card className="max-w-sm">
                    <CardHeader>
                        <CardTitle>카드 제목</CardTitle>
                        <CardDescription>카드에 대한 보조 설명</CardDescription>
                    </CardHeader>
                    <CardContent>본문 내용이 들어가는 영역</CardContent>
                    <CardFooter>
                        <Button size="sm">액션</Button>
                    </CardFooter>
                </Card>
            </Section>

            <Section
                title="Table"
                usage="행·열 데이터 나열 — 관리자의 응모자 명단, 추첨 이력, 어뷰징 목록"
            >
                <Table>
                    <TableCaption>응모자 명단 예시</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>이름</TableHead>
                            <TableHead>응모권</TableHead>
                            <TableHead>상태</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>홍길동</TableCell>
                            <TableCell>3장</TableCell>
                            <TableCell>유효</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>김철수</TableCell>
                            <TableCell>1장</TableCell>
                            <TableCell>검토 대기</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Section>

            <Section
                title="Dialog"
                usage="확인·입력이 필요한 모달 — 당첨 취소 사유 입력, 추첨 실행 확인"
            >
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="secondary">모달 열기</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>추첨을 실행할까요?</DialogTitle>
                            <DialogDescription>실행 후에는 되돌릴 수 없습니다.</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="secondary">취소</Button>
                            <Button>실행</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </Section>

            <Section
                title="Sonner (Toast)"
                usage="화면 구석에 잠깐 떴다 사라지는 알림 — 응모 완료, 오류 안내"
            >
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => toast.success('응모가 완료되었습니다')}
                    >
                        success
                    </Button>
                    <Button variant="secondary" onClick={() => toast.error('응모권이 부족합니다')}>
                        error
                    </Button>
                    <Button variant="secondary" onClick={() => toast('결과 발표가 예정되었습니다')}>
                        default
                    </Button>
                </div>
            </Section>

            <Section
                title="RewardDialog · 캡슐 뽑기"
                usage="게임 보상 모달 — 손잡이나 '보상 뽑기'를 누르면 캡슐이 나와 열리며 받은 등급의 응모권을 보여 준다"
            >
                <RewardDialogPreview />
            </Section>

            <Section
                title="Loading · Skeleton"
                usage="로딩은 페이지·모달처럼 모양을 모를 때, 스켈레톤은 목록·카드처럼 모양을 알 때"
            >
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="border-border-default rounded-2xl border">
                        <Loading />
                    </div>
                    <div className="flex flex-col gap-4">
                        <Skeleton className="h-40 rounded-2xl" />
                        <SkeletonList count={3} />
                    </div>
                </div>
            </Section>
        </main>
    );
}
