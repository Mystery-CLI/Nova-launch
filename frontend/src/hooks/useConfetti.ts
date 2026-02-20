import { useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';

interface UseConfettiOptions {
    /** Duration of the confetti burst in milliseconds. Default: 2500 */
    duration?: number;
    /** Brand colors to use. Defaults to a festive palette. */
    colors?: string[];
    /** Disable for users who prefer reduced motion. Default: true */
    disableForReducedMotion?: boolean;
}

/**
 * useConfetti — fires a celebratory confetti burst using canvas-confetti.
 *
 * Usage:
 *   const { fire } = useConfetti();
 *   fire();
 */
export function useConfetti(options: UseConfettiOptions = {}) {
    const {
        duration = 2500,
        colors = ['#10B981', '#3B82F6', '#F59E0B', '#F97316', '#8B5CF6', '#EC4899'],
        disableForReducedMotion = true,
    } = options;

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stop = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const fire = useCallback(() => {
        // Respect prefers-reduced-motion
        if (
            disableForReducedMotion &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            return;
        }

        stop(); // clear any previous burst

        const animationEnd = Date.now() + duration;
        const defaults = {
            startVelocity: 30,
            spread: 360,
            ticks: 60,
            zIndex: 9999,
            colors,
            disableForReducedMotion,
        };

        const randomInRange = (min: number, max: number) =>
            Math.random() * (max - min) + min;

        intervalRef.current = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                stop();
                return;
            }

            const particleCount = 50 * (timeLeft / duration);

            // Fire from both sides for a symmetric burst
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            });
        }, 250);
    }, [duration, colors, disableForReducedMotion, stop]);

    return { fire, stop };
}
