
// 简单的 8-bit 音效合成器 & 震动反馈

let audioCtx: AudioContext | null = null;

const getCtx = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

type SoundType = 'pop' | 'click' | 'coin' | 'success' | 'water' | 'error' | 'cancel';

export const playSound = (type: SoundType) => {
    try {
        const ctx = getCtx();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'pop') {
            // 清脆的点击声
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gainNode.gain.setValueAtTime(0.5, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            triggerHaptic(10); // 轻微震动
        } 
        else if (type === 'click') {
            // 普通UI点击
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        }
        else if (type === 'water') {
            // 模拟水声 (用低频正弦模拟)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(150, now + 0.2);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            triggerHaptic(20);
        }
        else if (type === 'coin') {
            // 金币声 (两段高音)
            osc.type = 'square';
            osc.frequency.setValueAtTime(987, now); // B5
            osc.frequency.setValueAtTime(1318, now + 0.08); // E6
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.setValueAtTime(0.1, now + 0.08);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            triggerHaptic([30, 50, 30]); // 双重震动
        }
        else if (type === 'success') {
            // 成功/升级 (上行琶音)
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554, now + 0.1);
            osc.frequency.setValueAtTime(659, now + 0.2);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
            triggerHaptic([50, 50, 50]);
        }
        else if (type === 'error') {
            // 错误/失败 (低锯齿波)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            triggerHaptic(100); // 长震动
        }
        else if (type === 'cancel') {
             // 取消/关闭
             osc.type = 'sine';
             osc.frequency.setValueAtTime(300, now);
             osc.frequency.linearRampToValueAtTime(100, now + 0.1);
             gainNode.gain.setValueAtTime(0.2, now);
             gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
             osc.start(now);
             osc.stop(now + 0.1);
        }

    } catch (e) {
        // 忽略音频上下文错误
    }
};

export const triggerHaptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
};
