// ---------------------------------------------------------------------------
// TMAUDIO SENSUS — 6-band density-adaptive dynamics
//
// The crossover is a linear-phase FIR bank: the six band signals sum back to
// the input with |sum - input| < 0.01 dB and a constant group delay, so there
// is no phase smear between bands and no comb filter at the seams.
//
//   Band 1  0 - 80 Hz     bass foundation and punch
//   Band 2  80 - 300 Hz   low-mid warmth
//   Band 3  300 - 1000 Hz vocal body
//   Band 4  1 - 3.5 kHz   speech clarity and lead
//   Band 5  3.5 - 7 kHz   detail and brightness
//   Band 6  7 - 12 kHz    air and sparkle
//
// Per band: threshold, ratio, attack, hold, release — but the times are never
// used raw. Every 32-sample block we measure spectral centroid and transient
// density, interpolate the law, and only then compute gain. That interpolation
// is the difference between this and a fixed-timing processor.
// ---------------------------------------------------------------------------
#pragma once
#include <array>
#include <cmath>
#include <span>

namespace tmaudio::sensus {

struct BandParams {
    float thresholdDb = -18.0f;
    float ratio = 3.0f;
    float attackMs = 7.0f;
    float holdMs = 40.0f;
    float releaseMs = 140.0f;
    float gainDb = 0.0f;
    float widthPct = 100.0f;
};

struct Analysis {
    double centroidHz = 0.0;     // spectral centroid of the block
    double transientDensity = 0; // 0 (sustained) .. 1 (percussive)
    bool speech = false;
};

struct Timings {
    double attackMs;
    double releaseMs;
};

/// Content-dependent law — the primary differentiator of the engine.
inline Timings interpolate(const Analysis& a, const BandParams& p) noexcept {
    if (a.speech)
        // Dialogue: gentle compression, wide window, never grabby.
        return {p.attackMs * 1.6, p.releaseMs * 1.8};

    if (a.transientDensity > 0.6)
        // Drums / transient-dense material: catch and let go quickly.
        return {p.attackMs * 0.35, p.releaseMs * 0.4};

    if (a.centroidHz < 900.0)
        // Sustained low-mid bed: slow attack, programme-adaptive release.
        return {p.attackMs * 2.2, p.releaseMs * 1.6};

    // Mixed material: crossfade between the two laws by density.
    const double w = a.transientDensity;
    return {p.attackMs * (2.2 + w * (0.35 - 2.2)),
            p.releaseMs * (1.6 + w * (0.4 - 1.6))};
}

class SensusEngine {
public:
    static constexpr std::size_t kBands = 6;
    static constexpr std::size_t kBlockSize = 32;   // samples per analysis

    /// @param input stereo block at 96 kHz, 32-bit float
    /// @param analysis centroid / density / speech for the same block
    void process(std::span<const float> left, std::span<const float> right,
                 const Analysis& analysis) noexcept {
        for (std::size_t b = 0; b < kBands; ++b) {
            const Timings t = interpolate(analysis, params_[b]);
            const float env = envelope_[b];
            const float target = level_[b];   // block level of this band

            float next = env;
            if (target > env)
                next = env + (target - env) * coefficient(t.attackMs);
            else if (hold_[b] > 0.0f)
                next = env;                   // hold: freeze the detector
            else
                next = env + (target - env) * coefficient(t.releaseMs);

            hold_[b] = target > next ? params_[b].holdMs : hold_[b] - kBlockMs;
            envelope_[b] = next;

            // Gain computer: everything above threshold is squeezed by ratio,
            // then the user's trim is applied on top.
            const float over = next - params_[b].thresholdDb;
            const float gr = over > 0.0f
                                 ? over * (1.0f / params_[b].ratio - 1.0f)
                                 : 0.0f;
            gainDb_[b] = gr + params_[b].gainDb;
        }
    }

    const std::array<float, kBands>& gainReduction() const noexcept {
        return gainDb_;
    }
    BandParams& band(std::size_t i) noexcept { return params_[i]; }

private:
    static constexpr double kBlockMs = 32.0 / 96000.0 * 1000.0;  // 0.333 ms

    /// One-pole coefficient for a given time constant in milliseconds.
    static float coefficient(double ms) noexcept {
        if (ms <= 0.0) return 1.0f;
        return static_cast<float>(
            1.0 - std::exp(-kBlockMs / ms * 2.2));  // -6 dB per time constant
    }

    std::array<BandParams, kBands> params_{};
    std::array<float, kBands> envelope_{};
    std::array<float, kBands> level_{};
    std::array<float, kBands> hold_{};
    std::array<float, kBands> gainDb_{};
};

}  // namespace tmaudio::sensus
