import { getDataSource } from '../config/dataSource';
import { DATA_SOURCE_LABEL } from './dataSourceLabel';
import { FOOTER_AWARDS, FOOTER_LINKS, FOOTER_TEAM } from './footerData';

/**
 * 사용자 화면 푸터 — 위에서부터 약관 줄 → 회사·팀 정보와 인증 표시 → 저작권·데이터 출처.
 * 한 덩어리로 이어 적던 글을 세 칸으로 나눴다. 칸 사이는 선 없이 여백(40)으로만 끊는다 — 선을 겹겹이 두면 어두운 바탕에서 줄이 남발돼 보였다.
 * 밝은 글(border-default)은 이름·제목처럼 먼저 읽을 것, 흐린 글(fg-tertiary)은 덧붙이는 설명이다
 */
export function UserFooter() {
    return (
        <footer className="bg-surface-inverse text-caption text-fg-tertiary">
            <div className="mx-auto flex w-full max-w-312 flex-col gap-10 px-6 pt-12 pb-16">
                {/* 약관 — 세로선 대신 간격으로만 나눈다. 굵은 두 개는 법정 강조 항목 */}
                <ul className="text-border-default flex flex-wrap gap-x-5 gap-y-2">
                    {FOOTER_LINKS.map(({ label, strong }) => (
                        <li key={label} className={strong ? 'font-bold' : undefined}>
                            {label}
                        </li>
                    ))}
                </ul>

                <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
                    <div className="flex flex-col gap-4">
                        <p className="text-body-bold text-border-default tracking-tight">
                            U<span className="text-fg-brand">+</span> GETDDO
                        </p>
                        <p>(주)얻어가유 · 서울특별시 어쩌구 저쩌구 멀티캠퍼스 선릉위워크</p>
                        {/* 만든 사람 — 역할 이름을 왼쪽 칸에 맞춰 세워 두 줄이 같은 자리에서 시작한다 */}
                        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
                            {FOOTER_TEAM.map(({ role, members }) => (
                                <div key={role} className="contents">
                                    <dt className="text-border-default font-bold">{role}</dt>
                                    <dd>{members.join(' · ')}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    {/* 수상·인증 — 아이콘은 꾸밈, 뜻은 글자로 전한다. 넓은 화면에서는 3칸 2줄로 오른쪽에 모은다 */}
                    <ul className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                        {FOOTER_AWARDS.map(({ icon, title, detail }) => (
                            <li key={title} className="flex items-center gap-2.5">
                                <img src={icon} alt="" className="h-8 w-10 shrink-0 opacity-70" />
                                <p className="flex min-w-0 flex-col">
                                    <span className="text-border-default">{title}</span>
                                    <span>{detail}</span>
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    <p>Copyright ⓒ U+GETDDO Corp. All Rights Reserved.</p>
                    {/* 이번 방문의 데이터 출처 — 서버가 닿지 않으면 예시 데이터로 보여 주므로 실데이터와 구분한다 */}
                    <p>{DATA_SOURCE_LABEL[getDataSource()]}</p>
                </div>
            </div>
        </footer>
    );
}
