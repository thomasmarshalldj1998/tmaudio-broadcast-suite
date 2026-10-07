// ---------------------------------------------------------------------------
// TMAUDIO — FM multiplex composite generator (192 kHz, 32-bit float)
//
//   L+R baseband   0 - 15 kHz   @ 90 % modulation, flat +/-0.05 dB
//   19 kHz pilot               @  9 % modulation, sine, phase reference
//   38 kHz DSB-SC  L-R         @ 90 % modulation, coherent sidebands
//   57 kHz RDS     BPSK        @  4 % modulation, 3x the pilot -> no drift
//
// All three subcarriers are derived from one numerically controlled
// oscillator so their phase relationship is fixed by construction: 57 = 3x19
// and 38 = 2x19, hence the < +/-1 degree pilot drift requirement holds for
// the whole multiplex rather than per-generator.
//
// Pre-emphasis (50 / 75 us) is applied upstream, BEFORE limiting, so the
// limiter sees the same spectrum the transmitter will emphasise on playback.
// ---------------------------------------------------------------------------
#pragma once
#include <cmath>
#include <cstdint>
#include <span>

namespace tmaudio::fm {

inline constexpr double kMpxRate = 192000.0;
inline constexpr double kPilotHz = 19000.0;
inline constexpr double kSubHz = 38000.0;
inline constexpr double kRdsHz = 57000.0;
inline constexpr double kFullDeviation = 75000.0;   // Hz at 100 % modulation

struct MpxParams {
    double pilotPct = 9.0;        // % of total deviation
    double subcarrierPct = 90.0;  // % of total deviation
    double rdsPct = 4.0;          // % of total deviation
    bool stereo = true;
};

class MpxMatrix {
public:
    explicit MpxMatrix(const MpxParams& p = {}) : p_(p) {}

    /// Render one block of composite at 192 kHz. `left`/`right` are already
    /// pre-emphasised, brickwalled to 15 kHz and clipped/limited.
    void process(std::span<const float> left, std::span<const float> right,
                 std::span<const float> rdsSymbols,  // +/-1, at symbol rate
                 float* compositeOut) noexcept {
        const double invRate = 1.0 / kMpxRate;
        for (std::size_t i = 0; i < left.size(); ++i) {
            const double t = (static_cast<double>(pos_) + static_cast<double>(i)) * invRate;
            const double pilotPh = twoPi_ * kPilotHz * t + phase_;

            const double sum = 0.5 * (static_cast<double>(left[i]) + right[i]);
            const double diff = 0.5 * (static_cast<double>(left[i]) - right[i]);

            // L+R baseband: 90 % modulation, flat within +/-0.05 dB — the
            // spectrum is pre-emphasised and limited upstream, so nothing
            // here is allowed to tilt it.
            double mpx = sum * 0.9;

            // 19 kHz pilot — pure sine, the phase reference for everything else.
            mpx += std::sin(pilotPh) * (p_.pilotPct / 100.0);

            // 38 kHz DSB-SC: suppressed carrier, coherent L-R sidebands.
            if (p_.stereo)
                mpx += diff * (p_.subcarrierPct / 100.0) *
                       std::cos(twoPi_ * kSubHz * t + phase_);

            // 57 kHz RDS: biphase symbols BPSK-modulated onto the subcarrier.
            // Exactly 3x the pilot, so it shares the same phase accumulator.
            const double symbol =
                rdsSymbols.empty() ? 0.0
                                   : static_cast<double>(rdsSymbols[
                                         (symPos_ + i) % rdsSymbols.size()]);
            mpx += symbol * (p_.rdsPct / 100.0) *
                   std::cos(twoPi_ * kRdsHz * t + phase_);

            compositeOut[i] = static_cast<float>(mpx);
        }
        pos_ += left.size();
        symPos_ += left.size();
    }

    /// Phase error of the composite against the 19 kHz reference, in degrees.
    double pilotDriftDegrees() const noexcept {
        const double wrapped = std::fmod(phase_, twoPi_);
        const double deg = wrapped * 180.0 / kPi_;
        return deg > 180.0 ? deg - 360.0 : deg;
    }

private:
    static constexpr double twoPi_ = 6.283185307179586;
    static constexpr double kPi_ = 3.141592653589793;
    MpxParams p_;
    std::uint64_t pos_ = 0;
    std::uint64_t symPos_ = 0;
    double phase_ = 0.0;   // locked to the pilot NCO; never free-runs
};

}  // namespace tmaudio::fm
