#pragma once

// A small JSON value with serde_json's semantics, for the Community uploader.
//
// The Tauri uploader parses with serde_json, which keeps the kind of every number: `4` is an unsigned
// integer, `-3` a signed one and `4.0` a float, so `as_u64()` of `4.0` is None. QJsonDocument turns `4.0`
// into the integer 4, which would change what the history validator and the exchange response accept.
// This parser follows serde_json: strict RFC 8259 grammar, UTF-8 checked, lone surrogates rejected,
// nesting limited to 127 levels, numbers kept as u64 / i64 / f64 the way serde_json classifies them.
// Objects keep their members in order (duplicates too); get() returns the last one, as serde_json's
// Value (a BTreeMap) does.

#include <QByteArray>
#include <QString>

#include <cstdint>
#include <memory>
#include <optional>
#include <vector>

namespace community {

class JsonValue
{
public:
    enum class Type : quint8 { Null, Bool, PosInt, NegInt, Float, String, Array, Object };

    JsonValue() = default;
    JsonValue(const JsonValue &other);
    JsonValue(JsonValue &&other) noexcept = default;
    JsonValue &operator=(const JsonValue &other);
    JsonValue &operator=(JsonValue &&other) noexcept = default;

    static JsonValue null() { return JsonValue(); }
    static JsonValue boolean(bool value);
    static JsonValue fromU64(quint64 value);
    static JsonValue fromI64(qint64 value);   // non-negative values become PosInt, as serde_json does
    static JsonValue fromDouble(double value);
    static JsonValue string(const QString &value);
    static JsonValue array();
    static JsonValue object();
    template <typename T>
    static JsonValue optional(const std::optional<T> &value);

    Type type() const { return m_type; }
    bool isNull() const { return m_type == Type::Null; }
    bool isBool() const { return m_type == Type::Bool; }
    bool isNumber() const { return m_type == Type::PosInt || m_type == Type::NegInt || m_type == Type::Float; }
    bool isString() const { return m_type == Type::String; }
    bool isArray() const { return m_type == Type::Array; }
    bool isObject() const { return m_type == Type::Object; }

    // serde_json::Value::as_*: nullopt when the value is not of that kind.
    std::optional<bool> asBool() const;
    std::optional<quint64> asU64() const;
    std::optional<qint64> asI64() const;
    std::optional<double> asF64() const;
    std::optional<QString> asString() const;
    const QString &stringRef() const { return m_string; }

    // Arrays.
    int size() const;   // elements of an array, members of an object, else 0
    const JsonValue &at(int index) const;
    void append(JsonValue value);

    // Objects: get() is Value::get (the last member with that key, nullptr when absent or not an object).
    const JsonValue *get(const QString &key) const;
    const JsonValue &operator[](const QString &key) const;   // a static null when absent
    int count(const QString &key) const;                      // occurrences, for serde's duplicate-field check
    QString keyAt(int index) const;
    const JsonValue &valueAt(int index) const;
    // Replaces the last member with that key, or appends it.
    void insert(const QString &key, JsonValue value);
    void remove(const QString &key);

    // serde_json::to_vec: compact. sortKeys orders object members by key (serde_json's json! / Value
    // objects are BTreeMaps); without it the members keep their order (serde's derived structs).
    QByteArray toJson(bool sortKeys) const;

    bool operator==(const JsonValue &other) const;
    bool operator!=(const JsonValue &other) const { return !(*this == other); }

private:
    struct Container {
        std::vector<QString> keys;   // empty for arrays
        std::vector<JsonValue> values;
    };
    void write(QByteArray &out, bool sortKeys) const;
    Container &container();

    Type m_type = Type::Null;
    bool m_bool = false;
    union {   // by m_type: PosInt, NegInt, Float
        quint64 m_u = 0;
        qint64 m_i;
        double m_d;
    };
    QString m_string;
    std::unique_ptr<Container> m_container;

    friend class JsonParser;
};

template <typename T>
JsonValue JsonValue::optional(const std::optional<T> &value)
{
    if (!value)
        return JsonValue();
    if constexpr (std::is_same_v<T, QString>)
        return string(*value);
    else if constexpr (std::is_same_v<T, bool>)
        return boolean(*value);
    else if constexpr (std::is_signed_v<T>)
        return fromI64(qint64(*value));
    else
        return fromU64(quint64(*value));
}

// serde_json::from_slice::<Value>. Returns nullopt on any syntax error.
std::optional<JsonValue> parseJson(const QByteArray &bytes);

// A JSON string literal as serde_json writes it (", \ and control characters escaped, the rest raw UTF-8).
void writeJsonString(QByteArray &out, const QString &value);

}   // namespace community
