import type { TakkoOrderItemId } from '../model/takkoOrder';

import counter from '../assets/takkoOrder/counter.webp';
import customer0 from '../assets/takkoOrder/customer-0.webp';
import customer1 from '../assets/takkoOrder/customer-1.webp';
import customer2 from '../assets/takkoOrder/customer-2.webp';
import customer3 from '../assets/takkoOrder/customer-3.webp';
import customer4 from '../assets/takkoOrder/customer-4.webp';
import customer5 from '../assets/takkoOrder/customer-5.webp';
import customer6 from '../assets/takkoOrder/customer-6.webp';
import customer7 from '../assets/takkoOrder/customer-7.webp';
import customer8 from '../assets/takkoOrder/customer-8.webp';
import dizzy from '../assets/takkoOrder/dizzy.webp';
import menuCheese from '../assets/takkoOrder/menu-cheese.webp';
import menuNori from '../assets/takkoOrder/menu-nori.webp';
import menuScallion from '../assets/takkoOrder/menu-scallion.webp';
import menuShrimp from '../assets/takkoOrder/menu-shrimp.webp';
import noren from '../assets/takkoOrder/noren.webp';
import octopus from '../assets/takkoOrder/octopus.webp';
import plate from '../assets/takkoOrder/plate.webp';
import propBoxes from '../assets/takkoOrder/prop-boxes.webp';
import propSauces from '../assets/takkoOrder/prop-sauces.webp';
import propSticks from '../assets/takkoOrder/prop-sticks.webp';
import shelf from '../assets/takkoOrder/shelf.webp';
import steamA from '../assets/takkoOrder/steam-a.webp';
import steamB from '../assets/takkoOrder/steam-b.webp';
import steamC from '../assets/takkoOrder/steam-c.webp';
import wall from '../assets/takkoOrder/wall.webp';
import windowFrame from '../assets/takkoOrder/window.webp';
import { COLOR_WORD_BGM, COLOR_WORD_SOUNDS } from './colorWordAssets';

/** 메뉴 그림 — 피그마 image 237(토핑 타코야끼 모음)에서 잘라 정사각형으로 맞췄다 */
export const TAKKO_ORDER_IMAGES: Record<TakkoOrderItemId, string> = {
    scallion: menuScallion,
    cheese: menuCheese,
    shrimp: menuShrimp,
    nori: menuNori,
};

/**
 * 손님 — 피그마 image 236(손님 모음)의 동물 5명·사람 4명. 모두 같은 키로 늘려 맞췄다 —
 * 발이 늘 카운터 뒤에 가려 키가 작은 손님도 떠 보이지 않는다.
 * 문어처럼 생긴 노란 손님은 뺐다 (유플러스 캐릭터 무너와 겹쳐 보일 수 있다)
 */
export const TAKKO_ORDER_CUSTOMERS = [
    customer0,
    customer1,
    customer2,
    customer3,
    customer4,
    customer5,
    customer6,
    customer7,
    customer8,
] as const;

/** 가게 그림 — 노렌·선반(image 245에서 따로 잘라 노렌은 가운데, 선반은 왼쪽에 작게)·접시(image 239)·나무 카운터(image 246) */
export const TAKKO_ORDER_SCENE = { noren, shelf, plate, counter } as const;

/** 카운터 위 소품 — 꼬치 통·소스 받침·포장 상자(image 250) */
export const TAKKO_ORDER_PROPS = {
    sticks: propSticks,
    sauces: propSauces,
    boxes: propBoxes,
} as const;

/** 틀렸을 때 메뉴 버튼이 잠깐 바뀌는 어지러운 타코야끼 (image 235 왼쪽) */
export const TAKKO_ORDER_WRONG_IMAGE = dizzy;

/** 음악·효과음 — 전용 소리가 나오기 전까지 글자색깔 맞추기와 같은 것을 쓴다 */
export const TAKKO_ORDER_BGM = COLOR_WORD_BGM;
export const TAKKO_ORDER_SOUNDS = {
    correct: COLOR_WORD_SOUNDS.correct,
    wrong: COLOR_WORD_SOUNDS.wrong,
    gameOver: COLOR_WORD_SOUNDS.gameOver,
};

/** 벽 — 타꼬 타이밍 맞추기 배경의 들보·미색 벽만 잘라 판 비율로 늘렸다 (타일은 뺐다). 문어 장식(image 248)·창문(image 251) */
export const TAKKO_ORDER_WALL = { wall, octopus, window: windowFrame } as const;

/** 김 (image 248) — 접시에 타코야끼가 담길 때마다 하나씩 돌아가며 쓴다 */
export const TAKKO_ORDER_STEAM = [steamA, steamB, steamC] as const;
