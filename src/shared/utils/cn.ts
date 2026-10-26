// cn의 충돌 병합은 Tailwind 기본 그룹 기준 — 커스텀 토큰(text-caption 같은 타이포와
// text-fg-* 같은 색상)을 함께 넣으면 같은 text-* 그룹으로 보고 앞 클래스를 지운다.
// 그 조합은 cn 대신 문자열 결합을 쓴다 (규칙 원문: docs/DESIGN-SYSTEM.md 0번 원칙)
export { cn } from 'cn';
