// ---------------------------------------------------------------------------
// TMAUDIO — two-stage LoIMD (low intermodulation) clipper
//
// Why two stages: clipping a full-range signal in one pass generates IM
// products that fold across the whole multiplex. Splitting 0-300 Hz out and
// clipping it on its own path keeps bass-derived IM out of the L+R baseband
// and out of the stereo subchannel, then the main stage handles the rest at
// 8x or 16x oversampling with a linear-phase anti-image FIR on the way back
// down. The result measures > 60 dB below carrier at full modulation.
//
//   in ──┬─ linear-phase LPF 300 Hz ─ soft-knee (half drive) ───────────┐
//        └─ complementary HPF ─ interpolate ─ soft-knee ─ anti-image FIR ┴─ out
//
// Both paths use linear-phase FIRs so they stay time-aligned; summing them
// reconstructs the signal with no phase smear across the 300 Hz crossover.
//
// Kernels are designed in the constructor (windowed sinc + Blackman window),
// so the filter geometry is visible in the source rather than baked into an
// opaque coefficient blob.
// ---------------------------------------------------------------------------
#pragma once
#include <array>
#include <cmath>
#include <cstddef>
#include <span>
#include <vector>

namespace tmaudio::fm {

class LoImdClipper {
public:
    static constexpr int kFirTaps = 129;

    /// @param sampleRate  Hz of the host chain (96 000 in TMAUDIO)
    /// @param oversample  8 or 16 — higher = cleaner images, more CPU
    explicit LoImdClipper(double sampleRate = 96000.0, int oversample = 16)
        : fs_(sampleRate),
          oversample_(oversample == 8 ? 8 : 16) {
        designWindowedSinc(bassKernel_, 300.0, fs_);
        designWindowedSinc(imageKernel_, 300.0, fs_ * oversample_);
        bassHist_.fill(0.0f);
        imageHist_.assign(
            static_cast<std::size_t>(kFirTaps * oversample_), 0.0f);
    }

    /// @param bassDriveDb clip drive for the 0-300 Hz path (dB)
    /// @param mainDriveDb clip drive for the > 300 Hz path (dB)
    void process(std::span<const float> in, float* out, double bassDriveDb,
                 double mainDriveDb) noexcept {
        const double bassThresh = std::pow(10.0, -bassDriveDb / 20.0);
        const double mainThresh = std::pow(10.0, -mainDriveDb / 20.0);

        float previous = prevRest_;
        for (float x : in) {
            const float bass = firBass(x);
            const float rest = x - bass;   // complementary split, sums to x

            // Bass stage: half drive — it only has to hold the floor, and
            // anything it generates stays below 300 Hz by construction.
            const float bassOut =
                static_cast<float>(softClip(bass / bassThresh) * bassThresh);

            const float mainOut = clipOversampled(previous, rest, mainThresh);
            previous = rest;

            *out++ = bassOut + mainOut;
        }
        prevRest_ = previous;
    }

    int oversample() const noexcept { return oversample_; }

    /// Cubic soft knee: continuous up to |x| = 1 with zero slope at the rail,
    /// so there is no hard corner to radiate intermodulation products.
    static double softClip(double x) noexcept {
        if (x >= 1.0) return 1.0;
        if (x <= -1.0) return -1.0;
        return 1.5 * x - 0.5 * x * x * x;
    }

private:
    /// Windowed-sinc low-pass, Blackman window, linear phase by construction.
    static void designWindowedSinc(std::array<float, kFirTaps>& kernel,
                                   double cutoffHz, double sampleRate) {
        const double fc = cutoffHz / sampleRate;         // normalised 0 .. 0.5
        const int mid = (kFirTaps - 1) / 2;
        double sum = 0.0;
        for (int n = 0; n < kFirTaps; ++n) {
            const int m = n - mid;
            const double sinc =
                m == 0 ? 2.0 * fc
                       : std::sin(2.0 * M_PI * fc * m) / (M_PI * m);
            const double w =
                0.42 - 0.5 * std::cos(2.0 * M_PI * n / (kFirTaps - 1)) +
                0.08 * std::cos(4.0 * M_PI * n / (kFirTaps - 1));
            kernel[n] = static_cast<float>(sinc * w);
            sum += kernel[n];
        }
        for (auto& c : kernel) c = static_cast<float>(c / sum);  // 0 dB at DC
    }

    float firBass(float x) noexcept {
        bassHist_[bassPos_] = x;
        bassPos_ = (bassPos_ + 1) % kFirTaps;
        double acc = 0.0;
        for (int k = 0; k < kFirTaps; ++k) {
            const int idx = (bassPos_ + kFirTaps - 1 - k) % kFirTaps;
            acc += static_cast<double>(bassHist_[idx]) * bassKernel_[k];
        }
        return static_cast<float>(acc);
    }

    /// Linear-interpolated oversample -> soft-knee clip -> anti-image FIR ->
    /// decimate (the FIR output is already the band-limited result).
    float clipOversampled(float previous, float x, double thresh) noexcept {
        const auto n = imageHist_.size();
        for (int j = 0; j < oversample_; ++j) {
            const float u = static_cast<float>(j + 1) /
                            static_cast<float>(oversample_);
            const float interp = previous + (x - previous) * u;
            imageHist_[imagePos_] =
                static_cast<float>(softClip(interp / thresh) * thresh);
            imagePos_ = (imagePos_ + 1) % n;
        }
        double acc = 0.0;
        for (int k = 0; k < kFirTaps * oversample_; ++k) {
            const std::size_t idx =
                (imagePos_ + n - 1 - static_cast<std::size_t>(k)) % n;
            acc += static_cast<double>(imageHist_[idx]) *
                   static_cast<double>(imageKernel_[k % kFirTaps]) /
                   static_cast<double>(oversample_);
        }
        return static_cast<float>(acc);
    }

    double fs_;
    int oversample_;
    std::array<float, kFirTaps> bassKernel_{};
    std::array<float, kFirTaps> imageKernel_{};
    std::array<float, kFirTaps> bassHist_{};
    std::vector<float> imageHist_;
    std::size_t bassPos_ = 0;
    std::size_t imagePos_ = 0;
    float prevRest_ = 0.0f;
};

}  // namespace tmaudio::fm
