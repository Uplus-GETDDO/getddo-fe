# GD-330 — `fg/brand` 색상 대비 위반 분석 (디자인 토큰 담당자 인계)

> 작성: 2026-10-23 · 상태: **코드 미수정 — 값 결정이 필요한 설계 이슈** · 대상 화면: `/admin/entries`

## 1. 증거

axe-core 4.10.3 기준선(`reports/20261023-gd328-baseline-axe.json`, 배포본)에서 `/admin/entries` desktop:

- 규칙 `color-contrast` · impact `serious` · **노드 20건**
- 대상 셀렉터(전부 동일 패턴): `tr:nth-child(N) > td:nth-child(3) > .hover\:underline.text-fg-brand`
- 같은 노드들이 `link-in-text-block`(incomplete, 링크가 색에만 의존)에도 걸린다

원인 요소: `EntryHistoryPanel`·`ParticipantsPanel`의 사용자 링크 — `text-fg-brand text-body-sm hover:underline`.

## 2. 원인

`--color-fg-brand: #E6007E`(라이트)의 실측 대비 — 아래는 WCAG 산식으로 계산한 값이며 axe 실측과 경계가 일치한다:

| 배경                       | 값        | 대비   | AA 본문(≥4.5)                                         |
| -------------------------- | --------- | ------ | ----------------------------------------------------- |
| `surface/page` `#FFFFFF`   | `#E6007E` | 4.50:1 | 경계 — axe는 실패로 기록                              |
| `surface/canvas` `#F4F5F7` | `#E6007E` | 4.13:1 | 실패                                                  |
| `brand/soft` `#FDEBF4`     | `#E6007E` | 3.94:1 | 실패 (`bg-brand-soft text-fg-brand` 뱃지 사용처 존재) |

즉 `fg/brand`는 "링크" 용도로 정의됐지만 흰 배경에서도 경계, 연한 회색·핑크 배경에서는 확실히 미달이다.

## 3. 제약 — 어떤 값이어도 동시에 만족해야 할 조건

1. 흰 배경 ≥ 4.5:1
2. `surface/canvas` ≥ 4.5:1 (표·카드가 회색 바탕 위에 놓일 수 있음)
3. `brand/soft` ≥ 4.5:1 (`bg-brand-soft text-fg-brand` 뱃지 조합이 이미 있음)
4. `fg/primary`(`#1F242B`)와 ≥ 3:1 — `link-in-text-block`: 밑줄 없는 링크는 본문색과 3:1 이상 달라야 함
5. 다크 모드는 별도 값(`#FF4DA3`)

**문제: 제약 3과 4가 겹치지 않는다.** brand-soft 위 4.5를 넘기려면 더 어두워야 하고, 본문색과 3:1을 유지하려면 더 밝아야 한다. 동일 색조 계열로는 두 조건을 동시에 채우는 값이 없다.

## 4. 후보 값 계산

| 후보                                | white | canvas | brand-soft | vs `fg/primary` | 판정                           |
| ----------------------------------- | ----- | ------ | ---------- | --------------- | ------------------------------ |
| `#E6007E` (현행)                    | 4.50  | 4.13   | 3.94       | 3.47            | canvas·soft 실패               |
| `#DC0077`                           | 4.87  | 4.47   | 4.26       | 3.20            | canvas·soft 실패               |
| `#D60074`                           | 5.11  | 4.68   | 4.47       | 3.06            | soft 0.03 미달, vsFG 마진 얇음 |
| `#D10072`                           | 5.31  | 4.87   | 4.64       | 2.94            | vsFG 실패(밑줄 필요)           |
| `#D0006F`                           | 5.37  | 4.92   | 4.70       | 2.91            | vsFG 실패(밑줄 필요)           |
| `#BC0066` (`brand/primary-pressed`) | 6.31  | 5.78   | 5.52       | 2.48            | vsFG 실패(밑줄 필요)           |

다크 모드 참고: `#FF4DA3`는 `surface/page` `#1F242B` 위 5.09:1로 통과하나 `surface/elevated` `#2B323C` 위 4.21:1로 미달 — 다크에서 띄운 카드·시트 위 링크도 같은 문제가 있다.

## 5. 선택지 (담당자 결정 필요)

- **A. 값만 조정 — `#D60074`** : white/canvas/vsFG 통과. `bg-brand-soft` 뱃지 텍스트만 별도 처리 필요(예: 뱃지 글자를 `fg/primary`로 — soft 배경 + 점으로 이미 구분됨). 단일 토큰이라 영향 범위가 전체 `fg/brand` 사용처.
- **B. 링크 전용 진한 토큰 신설** : `fg/brand`는 Figma 값 유지(로고·장식·큰 글자), 본문 링크용 `fg/link` 등을 추가. `brand-soft` 위 뱃지까지 커버하려면 `#CC0070` 급 + **밑줄 상시**(vsFG 제약 해소). 비-Figma 토큰 추가.
- **C. 링크에 밑줄 상시 + 진한 값** : vsFG 3:1 제약이 사라져 `#BC0066`급까지 자유 — 모든 배경 통과. 디자인상 상시 밑줄 허용 여부가 관건.
- **D. 다크 모드는 별행** : `#FF4DA3`를 유지할지, elevated 표면 기준으로 조정할지 별도 결정 (4.21:1 → ~5:1 필요 시 더 밝은 핑크).

## 6. 영향 범위 — `text-fg-brand` 사용처 분류

| 분류                 | 파일                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 관리자 링크          | `pages/admin/entries/ui/EntryHistoryPanel.tsx`, `ParticipantsPanel.tsx`, `pages/admin/users/ui/AdminUserDetailSheet.tsx`, `pages/admin/dashboard/ui/OpenEventsPanel.tsx` |
| 사용자 링크          | `pages/gameDetail/GameDetailPage.tsx`, `pages/missionDetail/MissionDetailPage.tsx`                                                                                       |
| 아이콘·점            | `pages/login/LoginPage.tsx`(ShieldCheck), `features/switchVirtualUser`(Check), `shared/ui/status-dot.tsx`                                                                |
| `bg-brand-soft` 뱃지 | `pages/admin/dashboard/ui/OpenEventsPanel.tsx`(인기), `entities/event/model/adminStatusMeta.ts`(TICKET), `features/controlVirtualClock/ui/VirtualClockControl.tsx`       |
| 로고·큰 글자         | `app/layouts/UserLayout.tsx`·`AdminLayout.tsx`(U+의 `+`), `pages/timeRaffle/ui/CloseCountdownChip.tsx`(title-2 — 대문자 대비 3:1 기준이라 현행 통과)                     |
| 기타 텍스트          | `pages/eventDetail/ui/EventDetailVisual.tsx`, `features/controlVirtualClock/ui/VirtualClockTicker.tsx`                                                                   |

## 7. 범위 밖 (별도 티켓 후보)

- 사용자 홈 `/`의 `color-contrast` violations 17건 + incomplete 16건 — `fg/brand` 링크 외 다른 요소 포함. 이번 인계는 `/admin/entries` 20건만 다룬다.
- `/admin/entries:w320`의 `link-in-text-block` incomplete 20건 — 위 선택지 B/C(밑줄)를 택하면 함께 해소된다.

## 8. 부기 — 2026-10-23 전체 관리자 화면 재측정에서 확인된 동일 계열

`reports/20261023-gd330-admin-lists.json`의 axe 재측정에서 `fg/brand`·soft 배경 계열 위반이 entries 외에도 퍼져 있음이 확인됐다. 인계 범위는 entries 20건이지만 값 결정 시 아래도 함께 고려하면 좋다:

- `/admin/events:desktop` `color-contrast` ×18 — `bg-brand-soft text-fg-brand` 뱃지(`adminStatusMeta.ts` TICKET), 제약 3의 실사례
- `/admin/entries?view=participants` 데스크톱·w320 `color-contrast` ×2 — entries와 같은 사용자 링크
- `/admin` 대시보드 데스크톱 `color-contrast` ×6(`dt` 스탯 라벨) + incomplete ×26(통계 카드), w320 incomplete ×42
- `/admin/tickets`·`/admin/missions` w320 `color-contrast` ×1 — `button[aria-label="N페이지"]`: 페이지네이션 가장자리 번호가 스크롤 클립 안에 잡힌 측정값. `fg/secondary`는 흰 배경 ~7.9:1로 실제는 통과라 클립 노이즈일 가능성이 크다
- `/admin/draw`·`/admin/missions` 데스크톱 `color-contrast` ×1 — 보조 텍스트(`.text-caption` 등)
- `/admin/users`·`/admin/entries` w320 `color-contrast` incomplete ×105/×122 — 대부분 표 th/td로 스크롤 클립 내 요소라 axe가 배경을 확정 못한 것
- `/admin/virtual-users` w320 `scrollable-region-focusable` ×1 — 표 스크롤 컨테이너 미래핍. 이 건은 GD-317 패턴으로 이번 PR에서 수정한다(키보드 접근성이라 대비 인계와 별개)
