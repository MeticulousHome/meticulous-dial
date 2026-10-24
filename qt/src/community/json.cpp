#include "json.h"

#include <QLocale>

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <limits>
#include <locale.h>
#include <numeric>

namespace community {

JsonValue::JsonValue(const JsonValue &other)
    : m_type(other.m_type), m_bool(other.m_bool), m_u(other.m_u), m_i(other.m_i), m_d(other.m_d),
      m_string(other.m_string)
{
    if (other.m_container)
        m_container = std::make_unique<Container>(*other.m_container);
}

JsonValue &JsonValue::operator=(const JsonValue &other)
{
    if (this != &other) {
        JsonValue copy(other);
        *this = std::move(copy);
    }
    return *this;
}

JsonValue JsonValue::boolean(bool value)
{
    JsonValue v;
    v.m_type = Type::Bool;
    v.m_bool = value;
    return v;
}

JsonValue JsonValue::fromU64(quint64 value)
{
    JsonValue v;
    v.m_type = Type::PosInt;
    v.m_u = value;
    return v;
}

JsonValue JsonValue::fromI64(qint64 value)
{
    if (value >= 0)
        return fromU64(quint64(value));
    JsonValue v;
    v.m_type = Type::NegInt;
    v.m_i = value;
    return v;
}

JsonValue JsonValue::fromDouble(double value)
{
    JsonValue v;
    v.m_type = Type::Float;
    v.m_d = value;
    return v;
}

JsonValue JsonValue::string(const QString &value)
{
    JsonValue v;
    v.m_type = Type::String;
    v.m_string = value;
    return v;
}

JsonValue JsonValue::array()
{
    JsonValue v;
    v.m_type = Type::Array;
    v.m_container = std::make_unique<Container>();
    return v;
}

JsonValue JsonValue::object()
{
    JsonValue v;
    v.m_type = Type::Object;
    v.m_container = std::make_unique<Container>();
    return v;
}

JsonValue::Container &JsonValue::container()
{
    if (!m_container)
        m_container = std::make_unique<Container>();
    return *m_container;
}

std::optional<bool> JsonValue::asBool() const
{
    if (m_type == Type::Bool)
        return m_bool;
    return std::nullopt;
}

std::optional<quint64> JsonValue::asU64() const
{
    if (m_type == Type::PosInt)
        return m_u;
    return std::nullopt;
}

std::optional<qint64> JsonValue::asI64() const
{
    if (m_type == Type::PosInt && m_u <= quint64(std::numeric_limits<qint64>::max()))
        return qint64(m_u);
    if (m_type == Type::NegInt)
        return m_i;
    return std::nullopt;
}

std::optional<double> JsonValue::asF64() const
{
    switch (m_type) {
    case Type::PosInt: return double(m_u);
    case Type::NegInt: return double(m_i);
    case Type::Float: return m_d;
    default: return std::nullopt;
    }
}

std::optional<QString> JsonValue::asString() const
{
    if (m_type == Type::String)
        return m_string;
    return std::nullopt;
}

int JsonValue::size() const
{
    if ((m_type == Type::Array || m_type == Type::Object) && m_container)
        return int(m_container->values.size());
    return 0;
}

const JsonValue &JsonValue::at(int index) const
{
    static const JsonValue nullValue;
    if (m_type != Type::Array || !m_container || index < 0 || index >= int(m_container->values.size()))
        return nullValue;
    return m_container->values[size_t(index)];
}

void JsonValue::append(JsonValue value)
{
    if (m_type != Type::Array)
        return;
    container().values.push_back(std::move(value));
}

const JsonValue *JsonValue::get(const QString &key) const
{
    if (m_type != Type::Object || !m_container)
        return nullptr;
    const auto &keys = m_container->keys;
    for (size_t i = keys.size(); i-- > 0;) {
        if (keys[i] == key)
            return &m_container->values[i];
    }
    return nullptr;
}

const JsonValue &JsonValue::operator[](const QString &key) const
{
    static const JsonValue nullValue;
    const JsonValue *value = get(key);
    return value ? *value : nullValue;
}

int JsonValue::count(const QString &key) const
{
    if (m_type != Type::Object || !m_container)
        return 0;
    return int(std::count(m_container->keys.begin(), m_container->keys.end(), key));
}

QString JsonValue::keyAt(int index) const
{
    if (m_type != Type::Object || !m_container || index < 0 || index >= int(m_container->keys.size()))
        return QString();
    return m_container->keys[size_t(index)];
}

const JsonValue &JsonValue::valueAt(int index) const
{
    static const JsonValue nullValue;
    if (m_type != Type::Object || !m_container || index < 0 || index >= int(m_container->values.size()))
        return nullValue;
    return m_container->values[size_t(index)];
}

void JsonValue::insert(const QString &key, JsonValue value)
{
    if (m_type != Type::Object)
        return;
    Container &c = container();
    for (size_t i = c.keys.size(); i-- > 0;) {
        if (c.keys[i] == key) {
            c.values[i] = std::move(value);
            return;
        }
    }
    c.keys.push_back(key);
    c.values.push_back(std::move(value));
}

void JsonValue::remove(const QString &key)
{
    if (m_type != Type::Object || !m_container)
        return;
    Container &c = *m_container;
    for (size_t i = c.keys.size(); i-- > 0;) {
        if (c.keys[i] == key) {
            c.keys.erase(c.keys.begin() + std::ptrdiff_t(i));
            c.values.erase(c.values.begin() + std::ptrdiff_t(i));
        }
    }
}

bool JsonValue::operator==(const JsonValue &other) const
{
    if (m_type != other.m_type)
        return false;
    switch (m_type) {
    case Type::Null: return true;
    case Type::Bool: return m_bool == other.m_bool;
    case Type::PosInt: return m_u == other.m_u;
    case Type::NegInt: return m_i == other.m_i;
    case Type::Float: return m_d == other.m_d;
    case Type::String: return m_string == other.m_string;
    case Type::Array: {
        if (size() != other.size())
            return false;
        for (int i = 0; i < size(); ++i) {
            if (at(i) != other.at(i))
                return false;
        }
        return true;
    }
    case Type::Object: {
        // Map equality (BTreeMap): the same keys with the same (last) values, in any order.
        if (!m_container || !other.m_container)
            return size() == other.size();
        for (const QString &key : m_container->keys) {
            const JsonValue *mine = get(key);
            const JsonValue *theirs = other.get(key);
            if (!theirs || *mine != *theirs)
                return false;
        }
        for (const QString &key : other.m_container->keys) {
            if (!get(key))
                return false;
        }
        return true;
    }
    }
    return false;
}

void writeJsonString(QByteArray &out, const QString &value)
{
    static const char hex[] = "0123456789abcdef";
    const QByteArray utf8 = value.toUtf8();
    out.append('"');
    for (const char ch : utf8) {
        const auto c = static_cast<unsigned char>(ch);
        switch (c) {
        case '"': out.append("\\\""); break;
        case '\\': out.append("\\\\"); break;
        case '\b': out.append("\\b"); break;
        case '\f': out.append("\\f"); break;
        case '\n': out.append("\\n"); break;
        case '\r': out.append("\\r"); break;
        case '\t': out.append("\\t"); break;
        default:
            if (c < 0x20) {
                out.append("\\u00");
                out.append(hex[c >> 4]);
                out.append(hex[c & 0xf]);
            } else {
                out.append(ch);
            }
        }
    }
    out.append('"');
}

static void writeDouble(QByteArray &out, double value)
{
    // serde_json writes non-finite floats as null and finite ones in their shortest round-trip form
    // (ryu); a float that is an integer keeps a ".0".
    if (!std::isfinite(value)) {
        out.append("null");
        return;
    }
    QByteArray text = QString::number(value, 'g', QLocale::FloatingPointShortest).toLatin1();
    if (!text.contains('.') && !text.contains('e') && !text.contains("inf") && !text.contains("nan"))
        text.append(".0");
    out.append(text);
}

void JsonValue::write(QByteArray &out, bool sortKeys) const
{
    switch (m_type) {
    case Type::Null: out.append("null"); break;
    case Type::Bool: out.append(m_bool ? "true" : "false"); break;
    case Type::PosInt: out.append(QByteArray::number(m_u)); break;
    case Type::NegInt: out.append(QByteArray::number(m_i)); break;
    case Type::Float: writeDouble(out, m_d); break;
    case Type::String: writeJsonString(out, m_string); break;
    case Type::Array: {
        out.append('[');
        for (int i = 0; i < size(); ++i) {
            if (i)
                out.append(',');
            at(i).write(out, sortKeys);
        }
        out.append(']');
        break;
    }
    case Type::Object: {
        out.append('{');
        if (m_container) {
            const auto &keys = m_container->keys;
            std::vector<size_t> order;
            if (sortKeys) {
                // A map has one entry per key (the last one) and orders them by the key's bytes.
                for (size_t i = 0; i < keys.size(); ++i) {
                    if (get(keys[i]) == &m_container->values[i])
                        order.push_back(i);
                }
                std::sort(order.begin(), order.end(),
                          [&](size_t a, size_t b) { return keys[a].toUtf8() < keys[b].toUtf8(); });
            } else {
                order.resize(keys.size());
                std::iota(order.begin(), order.end(), size_t(0));
            }
            bool first = true;
            for (size_t i : order) {
                if (!first)
                    out.append(',');
                first = false;
                writeJsonString(out, keys[i]);
                out.append(':');
                m_container->values[i].write(out, sortKeys);
            }
        }
        out.append('}');
        break;
    }
    }
}

QByteArray JsonValue::toJson(bool sortKeys) const
{
    QByteArray out;
    write(out, sortKeys);
    return out;
}

// --- Parser -------------------------------------------------------------------------------------

class JsonParser
{
public:
    explicit JsonParser(const QByteArray &bytes)
        : m_p(reinterpret_cast<const unsigned char *>(bytes.constData())), m_end(m_p + bytes.size())
    {
    }

    std::optional<JsonValue> parseDocument()
    {
        JsonValue value;
        skipWhitespace();
        if (!parseValue(value))
            return std::nullopt;
        skipWhitespace();
        if (m_p != m_end)
            return std::nullopt;   // trailing characters
        return value;
    }

private:
    void skipWhitespace()
    {
        while (m_p < m_end && (*m_p == ' ' || *m_p == '\t' || *m_p == '\n' || *m_p == '\r'))
            ++m_p;
    }

    bool literal(const char *text)
    {
        for (const char *t = text; *t; ++t, ++m_p) {
            if (m_p >= m_end || *m_p != static_cast<unsigned char>(*t))
                return false;
        }
        return true;
    }

    bool parseValue(JsonValue &out)
    {
        if (m_p >= m_end)
            return false;
        switch (*m_p) {
        case 'n':
            out = JsonValue();
            return literal("null");
        case 't':
            out = JsonValue::boolean(true);
            return literal("true");
        case 'f':
            out = JsonValue::boolean(false);
            return literal("false");
        case '"': {
            ++m_p;
            out.m_type = JsonValue::Type::String;
            return parseString(out.m_string);
        }
        case '[': return parseArray(out);
        case '{': return parseObject(out);
        default:
            if (*m_p == '-' || (*m_p >= '0' && *m_p <= '9'))
                return parseNumber(out);
            return false;
        }
    }

    bool enter()
    {
        // serde_json starts with a budget of 128 and fails when it reaches 0: 127 nested levels.
        if (--m_remainingDepth == 0)
            return false;
        return true;
    }
    void leave() { ++m_remainingDepth; }

    bool parseArray(JsonValue &out)
    {
        if (!enter())
            return false;
        ++m_p;   // [
        out = JsonValue::array();
        skipWhitespace();
        if (m_p < m_end && *m_p == ']') {
            ++m_p;
            leave();
            return true;
        }
        while (true) {
            JsonValue element;
            skipWhitespace();
            if (!parseValue(element))
                return false;
            out.m_container->values.push_back(std::move(element));
            skipWhitespace();
            if (m_p >= m_end)
                return false;
            if (*m_p == ',') {
                ++m_p;
                continue;
            }
            if (*m_p == ']') {
                ++m_p;
                leave();
                return true;
            }
            return false;
        }
    }

    bool parseObject(JsonValue &out)
    {
        if (!enter())
            return false;
        ++m_p;   // {
        out = JsonValue::object();
        skipWhitespace();
        if (m_p < m_end && *m_p == '}') {
            ++m_p;
            leave();
            return true;
        }
        while (true) {
            skipWhitespace();
            if (m_p >= m_end || *m_p != '"')
                return false;
            ++m_p;
            QString key;
            if (!parseString(key))
                return false;
            skipWhitespace();
            if (m_p >= m_end || *m_p != ':')
                return false;
            ++m_p;
            skipWhitespace();
            JsonValue value;
            if (!parseValue(value))
                return false;
            out.m_container->keys.push_back(std::move(key));
            out.m_container->values.push_back(std::move(value));
            skipWhitespace();
            if (m_p >= m_end)
                return false;
            if (*m_p == ',') {
                ++m_p;
                continue;
            }
            if (*m_p == '}') {
                ++m_p;
                leave();
                return true;
            }
            return false;
        }
    }

    static int hexValue(unsigned char c)
    {
        if (c >= '0' && c <= '9')
            return c - '0';
        if (c >= 'a' && c <= 'f')
            return c - 'a' + 10;
        if (c >= 'A' && c <= 'F')
            return c - 'A' + 10;
        return -1;
    }

    bool parseHex4(uint &out)
    {
        if (m_end - m_p < 4)
            return false;
        out = 0;
        for (int i = 0; i < 4; ++i) {
            const int h = hexValue(m_p[i]);
            if (h < 0)
                return false;
            out = (out << 4) | uint(h);
        }
        m_p += 4;
        return true;
    }

    static void appendUtf8(QByteArray &out, uint cp)
    {
        if (cp < 0x80) {
            out.append(char(cp));
        } else if (cp < 0x800) {
            out.append(char(0xC0 | (cp >> 6)));
            out.append(char(0x80 | (cp & 0x3F)));
        } else if (cp < 0x10000) {
            out.append(char(0xE0 | (cp >> 12)));
            out.append(char(0x80 | ((cp >> 6) & 0x3F)));
            out.append(char(0x80 | (cp & 0x3F)));
        } else {
            out.append(char(0xF0 | (cp >> 18)));
            out.append(char(0x80 | ((cp >> 12) & 0x3F)));
            out.append(char(0x80 | ((cp >> 6) & 0x3F)));
            out.append(char(0x80 | (cp & 0x3F)));
        }
    }

    // One UTF-8 sequence starting at m_p (a lead byte >= 0x80), validated as Rust's str does.
    bool takeUtf8Sequence(QByteArray &out)
    {
        const unsigned char c = *m_p;
        int length = 0;
        unsigned char min2 = 0x80, max2 = 0xBF;
        if (c >= 0xC2 && c <= 0xDF) {
            length = 2;
        } else if (c >= 0xE0 && c <= 0xEF) {
            length = 3;
            if (c == 0xE0)
                min2 = 0xA0;   // no overlongs
            if (c == 0xED)
                max2 = 0x9F;   // no surrogates
        } else if (c >= 0xF0 && c <= 0xF4) {
            length = 4;
            if (c == 0xF0)
                min2 = 0x90;
            if (c == 0xF4)
                max2 = 0x8F;   // <= U+10FFFF
        } else {
            return false;
        }
        if (m_end - m_p < length)
            return false;
        if (m_p[1] < min2 || m_p[1] > max2)
            return false;
        for (int i = 2; i < length; ++i) {
            if (m_p[i] < 0x80 || m_p[i] > 0xBF)
                return false;
        }
        out.append(reinterpret_cast<const char *>(m_p), length);
        m_p += length;
        return true;
    }

    bool parseString(QString &out)
    {
        QByteArray utf8;
        while (true) {
            const unsigned char *start = m_p;
            while (m_p < m_end && *m_p != '"' && *m_p != '\\' && *m_p >= 0x20 && *m_p < 0x80)
                ++m_p;
            utf8.append(reinterpret_cast<const char *>(start), int(m_p - start));
            if (m_p >= m_end)
                return false;
            const unsigned char c = *m_p;
            if (c == '"') {
                ++m_p;
                out = QString::fromUtf8(utf8);
                return true;
            }
            if (c < 0x20)
                return false;   // control character in a string
            if (c >= 0x80) {
                if (!takeUtf8Sequence(utf8))
                    return false;
                continue;
            }
            // Escape.
            ++m_p;
            if (m_p >= m_end)
                return false;
            const unsigned char e = *m_p++;
            switch (e) {
            case '"': utf8.append('"'); break;
            case '\\': utf8.append('\\'); break;
            case '/': utf8.append('/'); break;
            case 'b': utf8.append('\b'); break;
            case 'f': utf8.append('\f'); break;
            case 'n': utf8.append('\n'); break;
            case 'r': utf8.append('\r'); break;
            case 't': utf8.append('\t'); break;
            case 'u': {
                uint cp = 0;
                if (!parseHex4(cp))
                    return false;
                if (cp >= 0xDC00 && cp <= 0xDFFF)
                    return false;   // lone trailing surrogate
                if (cp >= 0xD800 && cp <= 0xDBFF) {
                    if (m_end - m_p < 2 || m_p[0] != '\\' || m_p[1] != 'u')
                        return false;   // lone leading surrogate
                    m_p += 2;
                    uint low = 0;
                    if (!parseHex4(low) || low < 0xDC00 || low > 0xDFFF)
                        return false;
                    cp = 0x10000 + ((cp - 0xD800) << 10) + (low - 0xDC00);
                }
                appendUtf8(utf8, cp);
                break;
            }
            default:
                return false;
            }
        }
    }

    bool parseNumber(JsonValue &out)
    {
        const unsigned char *start = m_p;
        const bool negative = *m_p == '-';
        if (negative)
            ++m_p;
        if (m_p >= m_end || *m_p < '0' || *m_p > '9')
            return false;
        bool overflow = false;
        quint64 significand = 0;
        if (*m_p == '0') {
            ++m_p;
            if (m_p < m_end && *m_p >= '0' && *m_p <= '9')
                return false;   // leading zero
        } else {
            while (m_p < m_end && *m_p >= '0' && *m_p <= '9') {
                const quint64 digit = *m_p - '0';
                if (significand > (std::numeric_limits<quint64>::max() - digit) / 10)
                    overflow = true;
                else
                    significand = significand * 10 + digit;
                ++m_p;
            }
        }
        bool isFloat = false;
        if (m_p < m_end && *m_p == '.') {
            isFloat = true;
            ++m_p;
            if (m_p >= m_end || *m_p < '0' || *m_p > '9')
                return false;
            while (m_p < m_end && *m_p >= '0' && *m_p <= '9')
                ++m_p;
        }
        if (m_p < m_end && (*m_p == 'e' || *m_p == 'E')) {
            isFloat = true;
            ++m_p;
            if (m_p < m_end && (*m_p == '+' || *m_p == '-'))
                ++m_p;
            if (m_p >= m_end || *m_p < '0' || *m_p > '9')
                return false;
            while (m_p < m_end && *m_p >= '0' && *m_p <= '9')
                ++m_p;
        }
        if (!isFloat && !overflow) {
            if (!negative) {
                out = JsonValue::fromU64(significand);
                return true;
            }
            // serde_json: -0 and magnitudes past i64 become floats.
            const qint64 neg = qint64(0 - significand);
            if (neg >= 0) {
                out = JsonValue::fromDouble(-double(significand));
                return true;
            }
            out.m_type = JsonValue::Type::NegInt;
            out.m_i = neg;
            return true;
        }
        static const locale_t cLocale = newlocale(LC_ALL_MASK, "C", locale_t(nullptr));
        const QByteArray text(reinterpret_cast<const char *>(start), int(m_p - start));
        char *endPtr = nullptr;
        const double value = strtod_l(text.constData(), &endPtr, cLocale);
        if (!std::isfinite(value))
            return false;   // number out of range
        out = JsonValue::fromDouble(value);
        return true;
    }

    const unsigned char *m_p;
    const unsigned char *m_end;
    int m_remainingDepth = 128;
};

std::optional<JsonValue> parseJson(const QByteArray &bytes)
{
    JsonParser parser(bytes);
    return parser.parseDocument();
}

}   // namespace community
