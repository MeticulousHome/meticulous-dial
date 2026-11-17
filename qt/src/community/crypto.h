#pragma once

// The primitives of the Community upload contract, matched to the Rust crates the Tauri Dial uses:
// ed25519-dalek (Ed25519 from a 32-byte seed, RFC 8032), sha2 (SHA-256, lower-case hex), base64's
// URL_SAFE_NO_PAD engine (strict: no padding, canonical trailing bits), rand_core's OsRng and uuid v4.
// Ed25519 comes from OpenSSL's libcrypto (Qt has no Ed25519).

#include <QByteArray>
#include <QString>

#include <optional>

namespace community::crypto {

// base64 URL_SAFE_NO_PAD.
QString base64UrlEncode(const QByteArray &bytes);
// Rejects padding, characters outside the URL-safe alphabet and non-canonical trailing bits, as the
// base64 crate's URL_SAFE_NO_PAD decoder does.
std::optional<QByteArray> base64UrlDecode(const QString &text);

QString sha256Hex(const QByteArray &bytes);

// Cryptographically secure random bytes (OpenSSL RAND_bytes, seeded from the OS).
QByteArray randomBytes(int count);

// A random (v4) UUID in lower-case hyphenated form, as uuid::Uuid::new_v4().to_string().
QString newUuid();
// uuid::Uuid::parse_str: hyphenated, simple (32 hex), {braced} or urn:uuid: forms, any case. Returns
// the lower-case hyphenated form.
std::optional<QString> parseUuid(const QString &text);

// The Ed25519 public key of a 32-byte seed (nullopt if the seed is not 32 bytes or OpenSSL fails).
std::optional<QByteArray> ed25519PublicKey(const QByteArray &seed);
// The 64-byte Ed25519 signature of message with the key of the seed.
std::optional<QByteArray> ed25519Sign(const QByteArray &seed, const QByteArray &message);
bool ed25519Verify(const QByteArray &publicKey, const QByteArray &message, const QByteArray &signature);

}   // namespace community::crypto
