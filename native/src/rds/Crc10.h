// ---------------------------------------------------------------------------
// TMAUDIO — RDS block assembler (EN 50067 / IEC 62106)
// Header-only, no dependencies, no lookup tables hidden from the reader.
//
// Block B layout (16 bits):
//   [15:12] group type (4) | [11] version | [10] TP | [9:5] PTY | [4:0] flags
//
// Checkword = CRC-10(data) XOR offset word. A decoder re-derives the
// remainder of the received 26-bit word; when it equals the offset word the
// block is accepted — that comparison is the "syndrome" check.
// ---------------------------------------------------------------------------
#pragma once
#include <array>
#include <cstdint>
#include <string_view>

namespace tmaudio::rds {

// G(x) = x^10 + x^8 + x^7 + x^5 + x^4 + x^3 + 1  (0b10110111001)
inline constexpr std::uint32_t kGenerator = 0x5B9;

// Offset words indexed by group label (type + version).
inline constexpr std::array<std::uint16_t, 32> kOffsetA = {
    0x0FC, 0x168, 0x350, 0x3D4, 0x20C, 0x244, 0x2E0, 0x380,
    0x334, 0x394, 0x2C8, 0x354, 0x234, 0x274, 0x2C4, 0x390};
inline constexpr std::array<std::uint16_t, 32> kOffsetB = {
    0x198, 0x1B4, 0x3B4, 0x2D4, 0x270, 0x2A4, 0x294, 0x300,
    0x318, 0x3A4, 0x2E4, 0x364, 0x218, 0x2B0, 0x384, 0x3C4};

/// 10-bit remainder of (block << 10) divided by G(x).
constexpr std::uint16_t crc10(std::uint16_t block) noexcept {
    std::uint32_t reg = static_cast<std::uint32_t>(block) << 10;
    for (int bit = 25; bit >= 10; --bit)
        if (reg & (1u << bit)) reg ^= kGenerator << (bit - 10);
    return static_cast<std::uint16_t>(reg & 0x3FF);
}

/// Checkword transmitted for a data block in the given group.
constexpr std::uint16_t checkword(std::uint16_t block, std::uint8_t groupType,
                                  bool versionB) noexcept {
    const auto offset =
        versionB ? kOffsetB[groupType & 0xF] : kOffsetA[groupType & 0xF];
    return static_cast<std::uint16_t>(crc10(block) ^ offset);
}

/// Decoder-side verification: true when the syndrome matches the offset.
constexpr bool verify(std::uint16_t block, std::uint16_t check,
                      std::uint8_t groupType, bool versionB) noexcept {
    const auto offset =
        versionB ? kOffsetB[groupType & 0xF] : kOffsetA[groupType & 0xF];
    return (check & 0x3FF) == checkword(block, groupType, versionB) &&
           crc10(block) == (check ^ offset);
}

/// 8-bit characters onto the RDS G0 charset, blank padded.
inline void encodeText(std::string_view text, std::uint8_t* out,
                       std::size_t length) noexcept {
    for (std::size_t i = 0; i < length; ++i) {
        const auto c = i < text.size() ? static_cast<unsigned char>(text[i])
                                       : static_cast<unsigned char>(' ');
        out[i] = (c > 0x7F && c < 0xA0) ? ' ' : c;  // G0 subset guard
    }
}

struct Block {
    std::uint16_t data;      // 16 information bits
    std::uint16_t check;     // 10 CRC bits XOR offset word
    std::uint8_t offset;     // offset word actually used (for the meter)
};

struct Group {
    std::uint8_t type;       // 0..15
    bool versionB;
    std::array<Block, 4> blocks;   // A, B, C, D
};

/// Block B builder: type | version | TP | PTY | group flags.
constexpr std::uint16_t makeBlockB(std::uint8_t type, bool versionB, bool tp,
                                   std::uint8_t pty,
                                   std::uint8_t flags) noexcept {
    return static_cast<std::uint16_t>(((type & 0xF) << 12) |
                                       ((versionB ? 1 : 0) << 11) |
                                       ((tp ? 1 : 0) << 10) |
                                       ((pty & 0x1F) << 5) | (flags & 0x1F));
}

/// Assemble one 0A group: PI | flags+address | 0 | two PS characters.
inline Group assemblePs(std::uint16_t pi, std::uint8_t pty, bool tp, bool ta,
                        bool ms, bool di, std::uint8_t segment,
                        const std::uint8_t ps[8]) noexcept {
    Group g{};
    g.type = 0;
    g.versionB = false;
    const auto flags = static_cast<std::uint8_t>(
        ((ta ? 1 : 0) << 4) | ((ms ? 1 : 0) << 3) | ((di ? 1 : 0) << 2) |
        (segment & 0x3));
    const std::uint16_t data[4] = {
        pi, makeBlockB(0, false, tp, pty, flags), 0u,
        static_cast<std::uint16_t>((ps[segment * 2] << 8) |
                                   ps[segment * 2 + 1])};
    for (int i = 0; i < 4; ++i)
        g.blocks[i] = {data[i], checkword(data[i], 0, false), 0xFC};
    return g;
}

/// Biphase (Manchester) shaping: each bit becomes two half-symbols, which
/// keeps the 57 kHz subcarrier DC-balanced before BPSK modulation.
inline void biphase(const std::uint16_t check, float* out) noexcept {
    for (int i = 9; i >= 0; --i) {
        const bool bit = (check >> i) & 1;
        *out++ = bit ? 1.0f : -1.0f;
        *out++ = bit ? -1.0f : 1.0f;
    }
}

}  // namespace tmaudio::rds
