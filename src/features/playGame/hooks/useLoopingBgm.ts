import { useCallback, useEffect, useRef, useState } from 'react';

import type { GameSound } from '../model/gameSounds';

/** 소리 단계별 음량 — 0은 음소거, 1~5단계 */
export const BGM_VOLUME_STEPS = [0, 0.1, 0.2, 0.35, 0.5, 0.7] as const;
export const BGM_MAX_LEVEL = BGM_VOLUME_STEPS.length - 1;
const DEFAULT_LEVEL = 3;

/** 소리 단계 — 다음에 들어와도 유지되도록 이 브라우저에 기억한다 */
const LEVEL_KEY = 'getddo:game-bgm-level';
const FADE_SECONDS = 0.6;
/** 효과음은 배경 음악보다 또렷하게 들리도록 같은 소리 단계에서 이만큼 크게 낸다 (최대 1) */
const EFFECT_BOOST = 1.6;
/** 일시정지할 때 음악을 뚝 끊지 않고 줄이는 시간 */
const PAUSE_FADE_SECONDS = 0.05;
/** 구간만 내는 효과음의 끝을 줄이는 시간 */
const EFFECT_FADE_SECONDS = 0.12;

// 개인 정보 보호 모드 등에서는 저장소 접근이 막힐 수 있어, 실패하면 기본 단계로 시작한다
function readLevel() {
    try {
        const raw = localStorage.getItem(LEVEL_KEY);
        const saved = Number(raw);
        return raw !== null && Number.isInteger(saved) && saved >= 0 && saved <= BGM_MAX_LEVEL
            ? saved
            : DEFAULT_LEVEL;
    } catch {
        return DEFAULT_LEVEL;
    }
}

function saveLevel(level: number) {
    try {
        localStorage.setItem(LEVEL_KEY, String(level));
    } catch {
        // 저장하지 못해도 이번 화면에서는 반영된다
    }
}

/**
 * 배경 음악을 끊김 없이 반복 재생한다 (Web Audio — <audio loop>는 반복 지점에서 틈이 생길 수 있다).
 * 브라우저는 사용자가 누르기 전에는 소리를 막으므로, play는 키·터치 같은 입력 처리 안에서 불러야 한다.
 * 화면을 떠나면 멈추고, 다른 탭으로 가면 잠시 멈췄다가 돌아오면 이어서 재생한다 (일시정지 중이면 계속 멈춰 둔다)
 */
export function useLoopingBgm(music: GameSound) {
    const src = music.url;
    /** 배경 음악 크기 배율 — 곡마다 원본 크기가 달라 맞춘다 */
    const musicVolumeRef = useRef(music.volume);
    const [level, setLevelState] = useState(readLevel);
    const ctxRef = useRef<AudioContext | null>(null);
    const gainRef = useRef<GainNode | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const bufferRef = useRef<Promise<AudioBuffer> | null>(null);
    /** 부딪혔을 때 줄이는 배율 — 다시 시작하면 1로 되돌린다 */
    const duckRef = useRef(1);
    const levelRef = useRef(level);
    /** 게임을 일시정지한 동안에는 탭을 다녀와도 다시 틀지 않는다 */
    const pausedRef = useRef(false);
    /** 풀어 둔 곡 — 일시정지 후 이어 틀 때 다시 풀지 않는다 */
    const decodedRef = useRef<AudioBuffer | null>(null);
    /** 곡을 처음부터 틀었다고 치면 시작했을 오디오 시각 — 지금 곡 위치를 계산한다 */
    const startedAtRef = useRef(0);
    /** 일시정지한 곡 위치(초) — 이어 틀 때 여기서부터 */
    const pausedOffsetRef = useRef(0);

    // 첫 재생이 늦지 않도록 화면에 들어오면 음원을 미리 받아 둔다 (풀기는 재생할 때)
    const bytesRef = useRef<Promise<ArrayBuffer> | null>(null);
    useEffect(() => {
        bytesRef.current = fetch(src).then((response) => response.arrayBuffer());
    }, [src]);

    /** 지금 단계·줄임 배율에 맞는 음량으로 서서히 옮긴다 */
    const applyVolume = useCallback((seconds = FADE_SECONDS) => {
        const ctx = ctxRef.current;
        const gain = gainRef.current;
        if (!ctx || !gain) return;
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(
            (BGM_VOLUME_STEPS[levelRef.current] ?? 0) * duckRef.current * musicVolumeRef.current,
            now + seconds,
        );
    }, []);

    /** 곡을 offset초 위치부터 반복 재생한다 */
    const startSource = useCallback((ctx: AudioContext, buffer: AudioBuffer, offset: number) => {
        if (!gainRef.current) return;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gainRef.current);
        source.start(0, offset);
        startedAtRef.current = ctx.currentTime - offset;
        sourceRef.current = source;
    }, []);

    /** 재생(이미 재생 중이면 원래 음량으로 되돌림) — 입력 처리 안에서 부른다 */
    const play = useCallback(() => {
        duckRef.current = 1;
        pausedRef.current = false;
        if (!ctxRef.current) {
            const ctx = new AudioContext();
            const gain = ctx.createGain();
            gain.gain.value = 0;
            gain.connect(ctx.destination);
            ctxRef.current = ctx;
            gainRef.current = gain;
        }
        const ctx = ctxRef.current;
        void ctx.resume();
        if (sourceRef.current) {
            applyVolume();
            return;
        }
        // 일시정지로 멈춰 둔 곡이 있으면 그 자리부터 다시 튼다
        if (decodedRef.current) {
            startSource(ctx, decodedRef.current, pausedOffsetRef.current);
            applyVolume();
            return;
        }
        bufferRef.current ??= (bytesRef.current ?? fetch(src).then((r) => r.arrayBuffer())).then(
            (bytes) => ctx.decodeAudioData(bytes),
        );
        void bufferRef.current
            .then((buffer) => {
                if (ctxRef.current !== ctx) return;
                decodedRef.current = buffer;
                // 푸는 사이 일시정지했으면 이어 할 때 튼다
                if (sourceRef.current || pausedRef.current) return;
                startSource(ctx, buffer, 0);
                applyVolume();
            })
            .catch(() => {
                // 음원을 못 불러와도 게임은 소리 없이 계속한다
            });
    }, [applyVolume, src, startSource]);

    /** 음량을 배율만큼 줄인다 (예: 부딪혔을 때 0.3) */
    /** 효과음 — 배경 음악과 같은 오디오에서 소리 단계를 따라 한 번 낸다 (음소거면 내지 않는다) */
    const effectBuffersRef = useRef(new Map<string, Promise<AudioBuffer>>());
    const playEffect = useCallback((sound: GameSound) => {
        const { url } = sound;
        const ctx = ctxRef.current;
        const volume = BGM_VOLUME_STEPS[levelRef.current] ?? 0;
        if (!ctx || volume === 0 || ctx.state !== 'running') return;
        let buffer = effectBuffersRef.current.get(url);
        if (!buffer) {
            buffer = fetch(url)
                .then((response) => response.arrayBuffer())
                .then((bytes) => ctx.decodeAudioData(bytes));
            effectBuffersRef.current.set(url, buffer);
        }
        void buffer
            .then((decoded) => {
                if (ctxRef.current !== ctx) return;
                const source = ctx.createBufferSource();
                const gain = ctx.createGain();
                const peak = Math.min(1, volume * EFFECT_BOOST * sound.volume);
                gain.gain.value = peak;
                source.buffer = decoded;
                source.connect(gain).connect(ctx.destination);
                const offset = sound.start ?? 0;
                if (sound.duration == null) {
                    source.start(0, offset);
                    return;
                }
                // 구간만 낼 때는 끝을 짧게 줄여 뚝 끊기지 않게 한다
                const end = ctx.currentTime + sound.duration;
                const fade = Math.min(EFFECT_FADE_SECONDS, sound.duration / 2);
                gain.gain.setValueAtTime(peak, end - fade);
                gain.gain.linearRampToValueAtTime(0, end);
                source.start(0, offset, sound.duration);
            })
            .catch(() => {
                // 효과음을 못 내도 게임은 계속한다
                effectBuffersRef.current.delete(url);
            });
    }, []);

    /** 효과음을 미리 받아 풀어 둔다 — 첫 점프 소리가 늦지 않게 */
    const preloadEffects = useCallback((sounds: readonly GameSound[]) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        for (const { url } of sounds) {
            if (effectBuffersRef.current.has(url)) continue;
            const buffer = fetch(url)
                .then((response) => response.arrayBuffer())
                .then((bytes) => ctx.decodeAudioData(bytes));
            buffer.catch(() => effectBuffersRef.current.delete(url));
            effectBuffersRef.current.set(url, buffer);
        }
    }, []);

    const duck = useCallback(
        (ratio: number) => {
            duckRef.current = ratio;
            applyVolume();
        },
        [applyVolume],
    );

    /**
     * 일시정지 — 배경 음악만 곡 위치를 기억하고 멈춘다. 오디오 자체는 켜 둬서
     * 이어 하기 소리가 늦지 않게 바로 난다 (오디오를 껐다 켜면 켜질 때까지 소리가 밀린다)
     */
    const pause = useCallback(
        (effect?: GameSound) => {
            pausedRef.current = true;
            const ctx = ctxRef.current;
            if (!ctx) return;
            if (effect) playEffect(effect);
            const now = ctx.currentTime;
            const gain = gainRef.current;
            if (gain) {
                gain.gain.cancelScheduledValues(now);
                gain.gain.setValueAtTime(gain.gain.value, now);
                gain.gain.linearRampToValueAtTime(0, now + PAUSE_FADE_SECONDS);
            }
            const source = sourceRef.current;
            if (!source) return;
            const duration = source.buffer?.duration ?? 0;
            pausedOffsetRef.current = duration > 0 ? (now - startedAtRef.current) % duration : 0;
            source.stop(now + PAUSE_FADE_SECONDS);
            sourceRef.current = null;
        },
        [playEffect],
    );

    /** 일시정지한 곳부터 이어서 재생한다 (음악은 서서히 커진다) — 입력 처리 안에서 부른다. effect는 이어 하기 소리 */
    const resume = useCallback(
        (effect?: GameSound) => {
            pausedRef.current = false;
            const ctx = ctxRef.current;
            if (!ctx) return;
            const restart = () => {
                if (ctxRef.current !== ctx || pausedRef.current) return;
                if (effect) playEffect(effect);
                if (!sourceRef.current && decodedRef.current) {
                    startSource(ctx, decodedRef.current, pausedOffsetRef.current);
                }
                applyVolume();
            };
            if (ctx.state === 'running') {
                restart();
                return;
            }
            // 다른 탭에 다녀와 오디오가 꺼져 있을 때만 켜질 때까지 기다린다 (켜지 못해도 게임은 소리 없이 이어 간다)
            ctx.resume()
                .then(restart)
                .catch(() => undefined);
        },
        [applyVolume, playEffect, startSource],
    );

    /** 소리 단계를 바꾼다 (0이면 음소거) */
    const setLevel = useCallback((next: number) => {
        const clamped = Math.min(BGM_MAX_LEVEL, Math.max(0, Math.round(next)));
        setLevelState(clamped);
        saveLevel(clamped);
    }, []);

    useEffect(() => {
        levelRef.current = level;
        musicVolumeRef.current = music.volume;
        applyVolume(0.2);
    }, [level, music.volume, applyVolume]);

    // 다른 탭으로 가면 멈추고, 돌아오면 이어서 재생한다
    useEffect(() => {
        const onVisibility = () => {
            const ctx = ctxRef.current;
            if (!ctx) return;
            // 일시정지 중이어도 오디오는 다시 켜 둔다 — 음악은 멈춰 있고, 이어 하기 소리가 바로 나도록
            if (document.hidden) ctx.suspend().catch(() => undefined);
            else ctx.resume().catch(() => undefined);
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    // 게임 화면을 떠나면 완전히 멈추고 정리한다
    useEffect(
        () => () => {
            sourceRef.current?.stop();
            sourceRef.current = null;
            void ctxRef.current?.close();
            ctxRef.current = null;
            gainRef.current = null;
            bufferRef.current = null;
            decodedRef.current = null;
            effectBuffersRef.current.clear();
        },
        [],
    );

    return { play, duck, pause, resume, playEffect, preloadEffects, level, setLevel };
}
