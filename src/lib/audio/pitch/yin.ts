/**
 * YIN Pitch Detection Algorithm
 * Optimized for Bansuri (Indian Flute) and monophonic acoustic instruments.
 * 
 * Features:
 * - Cumulative Mean Normalized Difference Function to prioritize fundamental over harmonics
 * - Sub-sample parabolic interpolation for precise frequency resolution (sub-cent accuracy)
 * - RMS gate to reject background noise & breath air when not sounding a note
 * - Zero external dependencies, pure Web Audio API compatible
 */

export interface YinDetectionResult {
    frequency: number;
    clarity: number; // 0 to 1
    rms: number;
}

export interface YinOptions {
    threshold?: number;       // YIN threshold (default: 0.12). Lower = stricter, prevents octave jumps
    minFreq?: number;         // Minimum detectable frequency in Hz (default: 65 Hz, covers deep bass bansuri)
    maxFreq?: number;         // Maximum detectable frequency in Hz (default: 2200 Hz, covers high register)
    minRms?: number;          // Minimum RMS amplitude threshold to accept sound (default: 0.015)
}

/**
 * Calculates the Root Mean Square (RMS) amplitude of an audio sample buffer.
 */
export function calculateRms(buffer: Float32Array): number {
    let sumSquares = 0;
    const len = buffer.length;
    for (let i = 0; i < len; i++) {
        const val = buffer[i];
        sumSquares += val * val;
    }
    return Math.sqrt(sumSquares / len);
}

/**
 * Runs the YIN algorithm on a windowed audio buffer.
 */
export function detectPitchYin(
    buffer: Float32Array,
    sampleRate: number,
    options: YinOptions = {}
): YinDetectionResult | null {
    const {
        threshold = 0.12,
        minFreq = 65,
        maxFreq = 2200,
        minRms = 0.015
    } = options;

    // 1. RMS Energy Check (Silence Gate)
    const rms = calculateRms(buffer);
    if (rms < minRms) {
        return null;
    }

    const halfBufferSize = Math.floor(buffer.length / 2);
    if (halfBufferSize <= 0) return null;

    // Bounds for tau (period lag)
    const minTau = Math.max(1, Math.floor(sampleRate / maxFreq));
    const maxTau = Math.min(halfBufferSize - 1, Math.floor(sampleRate / minFreq));

    if (minTau >= maxTau) return null;

    // 2. Step 1: Difference Function d(tau)
    const yinBuffer = new Float32Array(maxTau + 1);
    for (let tau = 1; tau <= maxTau; tau++) {
        let diff = 0;
        for (let i = 0; i < halfBufferSize; i++) {
            const delta = buffer[i] - buffer[i + tau];
            diff += delta * delta;
        }
        yinBuffer[tau] = diff;
    }

    // 3. Step 2: Cumulative Mean Normalized Difference Function d'(tau)
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
        runningSum += yinBuffer[tau];
        if (runningSum === 0) {
            yinBuffer[tau] = 1;
        } else {
            yinBuffer[tau] = (yinBuffer[tau] * tau) / runningSum;
        }
    }

    // 4. Step 3: Absolute Threshold Search
    let tauEstimate = -1;
    for (let tau = minTau; tau <= maxTau; tau++) {
        if (yinBuffer[tau] < threshold) {
            // Find the local minimum in this valley
            while (tau + 1 <= maxTau && yinBuffer[tau + 1] < yinBuffer[tau]) {
                tau++;
            }
            tauEstimate = tau;
            break;
        }
    }

    // If no tau was under the strict threshold, search for global minimum with relaxed clarity
    let minDip = 1.0;
    if (tauEstimate === -1) {
        let bestTau = -1;
        for (let tau = minTau; tau <= maxTau; tau++) {
            if (yinBuffer[tau] < minDip) {
                minDip = yinBuffer[tau];
                bestTau = tau;
            }
        }
        // If the best dip is still too noisy / unclear (> 0.4), reject
        if (minDip < 0.35 && bestTau > 0) {
            tauEstimate = bestTau;
        } else {
            return null;
        }
    } else {
        minDip = yinBuffer[tauEstimate];
    }

    if (tauEstimate <= 0) {
        return null;
    }

    // 5. Step 4: Parabolic Interpolation for Sub-sample Precision
    let betterTau = tauEstimate;
    const x0 = tauEstimate > 0 ? tauEstimate - 1 : tauEstimate;
    const x2 = tauEstimate < maxTau ? tauEstimate + 1 : tauEstimate;

    if (x0 !== tauEstimate && x2 !== tauEstimate) {
        const s0 = yinBuffer[x0];
        const s1 = yinBuffer[tauEstimate];
        const s2 = yinBuffer[x2];
        const denominator = 2 * (2 * s1 - s2 - s0);
        if (denominator !== 0) {
            const delta = (s2 - s0) / denominator;
            if (Math.abs(delta) < 1) {
                betterTau = tauEstimate + delta;
            }
        }
    }

    const frequency = sampleRate / betterTau;
    if (frequency < minFreq || frequency > maxFreq || isNaN(frequency) || !isFinite(frequency)) {
        return null;
    }

    const clarity = Math.max(0, Math.min(1, 1 - minDip));

    return {
        frequency,
        clarity,
        rms
    };
}
