#include "crypto.h"

#include <QCryptographicHash>

#include <openssl/evp.h>
#include <openssl/rand.h>

#include <memory>

namespace community::crypto {

QString base64UrlEncode(const QByteArray &bytes)
{
    return QString::fromLatin1(bytes.toBase64(QByteArray::Base64UrlEncoding | QByteArray::OmitTrailingEquals));
}

std::optional<QByteArray> base64UrlDecode(const QString &text)
{
    if (text.size() % 4 == 1)
        return std::nullopt;
    for (const QChar ch : text) {
        const ushort c = ch.unicode();
        const bool ok = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_';
        if (!ok)
            return std::nullopt;
    }
    const auto result = QByteArray::fromBase64Encoding(text.toLatin1(),
                                                       QByteArray::Base64UrlEncoding | QByteArray::AbortOnBase64DecodingErrors);
    if (!result)
        return std::nullopt;
    // Canonical: the unused low bits of the last character must be zero.
    if (base64UrlEncode(result.decoded) != text)
        return std::nullopt;
    return result.decoded;
}

QString sha256Hex(const QByteArray &bytes)
{
    return QString::fromLatin1(QCryptographicHash::hash(bytes, QCryptographicHash::Sha256).toHex());
}

QByteArray randomBytes(int count)
{
    QByteArray bytes(count, Qt::Uninitialized);
    if (RAND_bytes(reinterpret_cast<unsigned char *>(bytes.data()), count) != 1)
        qFatal("[CommunityUpload] the system random number generator failed");
    return bytes;
}

static QString formatUuid(const QByteArray &bytes)
{
    const QByteArray hex = bytes.toHex();
    return QString::fromLatin1(hex.mid(0, 8) + '-' + hex.mid(8, 4) + '-' + hex.mid(12, 4) + '-' + hex.mid(16, 4) + '-' +
                               hex.mid(20, 12));
}

QString newUuid()
{
    QByteArray bytes = randomBytes(16);
    bytes[6] = char((uchar(bytes[6]) & 0x0F) | 0x40);   // version 4
    bytes[8] = char((uchar(bytes[8]) & 0x3F) | 0x80);   // RFC 4122 variant
    return formatUuid(bytes);
}

std::optional<QString> parseUuid(const QString &input)
{
    QString text = input;
    if (text.size() == 45 && text.startsWith(QLatin1String("urn:uuid:"), Qt::CaseInsensitive))
        text = text.mid(9);
    else if (text.size() == 38 && text.startsWith(QLatin1Char('{')) && text.endsWith(QLatin1Char('}')))
        text = text.mid(1, 36);
    QString hex;
    if (text.size() == 36) {
        for (int i = 0; i < 36; ++i) {
            const bool dash = i == 8 || i == 13 || i == 18 || i == 23;
            if (dash != (text[i] == QLatin1Char('-')))
                return std::nullopt;
        }
        hex = text;
        hex.remove(QLatin1Char('-'));
    } else if (text.size() == 32) {
        hex = text;
    } else {
        return std::nullopt;
    }
    for (const QChar ch : hex) {
        const ushort c = ch.unicode();
        if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')))
            return std::nullopt;
    }
    return formatUuid(QByteArray::fromHex(hex.toLatin1()));
}

namespace {
struct PkeyDeleter {
    void operator()(EVP_PKEY *key) const { EVP_PKEY_free(key); }
};
struct MdCtxDeleter {
    void operator()(EVP_MD_CTX *ctx) const { EVP_MD_CTX_free(ctx); }
};
using Pkey = std::unique_ptr<EVP_PKEY, PkeyDeleter>;
using MdCtx = std::unique_ptr<EVP_MD_CTX, MdCtxDeleter>;

Pkey privateKey(const QByteArray &seed)
{
    if (seed.size() != 32)
        return nullptr;
    return Pkey(EVP_PKEY_new_raw_private_key(EVP_PKEY_ED25519, nullptr,
                                             reinterpret_cast<const unsigned char *>(seed.constData()), 32));
}
}   // namespace

std::optional<QByteArray> ed25519PublicKey(const QByteArray &seed)
{
    const Pkey key = privateKey(seed);
    if (!key)
        return std::nullopt;
    QByteArray out(32, Qt::Uninitialized);
    size_t length = 32;
    if (EVP_PKEY_get_raw_public_key(key.get(), reinterpret_cast<unsigned char *>(out.data()), &length) != 1 || length != 32)
        return std::nullopt;
    return out;
}

std::optional<QByteArray> ed25519Sign(const QByteArray &seed, const QByteArray &message)
{
    const Pkey key = privateKey(seed);
    if (!key)
        return std::nullopt;
    const MdCtx ctx(EVP_MD_CTX_new());
    if (!ctx || EVP_DigestSignInit(ctx.get(), nullptr, nullptr, nullptr, key.get()) != 1)
        return std::nullopt;
    QByteArray signature(64, Qt::Uninitialized);
    size_t length = 64;
    if (EVP_DigestSign(ctx.get(), reinterpret_cast<unsigned char *>(signature.data()), &length,
                       reinterpret_cast<const unsigned char *>(message.constData()), size_t(message.size())) != 1 ||
        length != 64)
        return std::nullopt;
    return signature;
}

bool ed25519Verify(const QByteArray &publicKey, const QByteArray &message, const QByteArray &signature)
{
    if (publicKey.size() != 32 || signature.size() != 64)
        return false;
    const Pkey key(EVP_PKEY_new_raw_public_key(EVP_PKEY_ED25519, nullptr,
                                               reinterpret_cast<const unsigned char *>(publicKey.constData()), 32));
    if (!key)
        return false;
    const MdCtx ctx(EVP_MD_CTX_new());
    if (!ctx || EVP_DigestVerifyInit(ctx.get(), nullptr, nullptr, nullptr, key.get()) != 1)
        return false;
    return EVP_DigestVerify(ctx.get(), reinterpret_cast<const unsigned char *>(signature.constData()), 64,
                            reinterpret_cast<const unsigned char *>(message.constData()), size_t(message.size())) == 1;
}

}   // namespace community::crypto
