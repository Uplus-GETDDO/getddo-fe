import certifiedIcon from './assets/footer/certified.png';
import headsetIcon from './assets/footer/headset.png';
import privacyIcon from './assets/footer/privacy.png';
import teamIcon from './assets/footer/team.png';
import trophyIcon from './assets/footer/trophy.png';
import verifiedIcon from './assets/footer/verified.png';

// 피그마 홈 푸터 — 약관 링크(굵게 강조 2개)와 회사·연락처 안내 (UI 문구만, 링크 연결은 추후)
export const FOOTER_LINKS = [
    { label: '이용약관' },
    { label: '위치정보이용약관', strong: true },
    { label: '개인정보처리방침', strong: true },
    { label: '프라이버시센터' },
    { label: '통신자료제공사실열람' },
    { label: '청소년보호정책' },
    { label: '이용자피해예방가이드' },
    { label: '미환급금조회' },
    { label: '명의도용방지서비스' },
    { label: '장애현황' },
    { label: '임직원 Happy Program' },
];

// 피그마 홈 푸터 하단 — 수상·인증 표시 (아이콘은 장식, 글자로 내용을 전달한다)
export const FOOTER_AWARDS = [
    { icon: trophyIcon, title: '융합프로젝트 만족도지수', detail: '2026 응모 플랫폼 부문 1위' },
    { icon: headsetIcon, title: '얻어가유 고객센터', detail: '품질지수 최우수 조 선정' },
    { icon: teamIcon, title: '한국팀플협회 협업지수', detail: '8인 팀워크혁신상 수상' },
    { icon: certifiedIcon, title: '한국추첨공정성지수', detail: '공정추첨 우수 플랫폼 선정' },
    { icon: verifiedIcon, title: '추첨 결과 정합성 검증', detail: '후보·조건·확정 결과 보존' },
    { icon: privacyIcon, title: '당첨자 개인정보 마스킹', detail: '안심 발표 시스템 적용' },
];
