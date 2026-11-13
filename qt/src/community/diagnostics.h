#pragma once

// community_upload/diagnostics.rs: allowlisted diagnostics only, never the persistent uploader state.
// Failures are logged once per (category, HTTP status) every 5 minutes; diagnostics.json (next to
// state.json, 0600) gets a sanitized status snapshot at most every 30 seconds.

#include "json.h"

#include <QString>

#include <functional>
#include <optional>

namespace community::diagnostics {

// The category when it is on the allowlist, else "other_error".
QString category(const QString &value);

// The suppression of repeated failure events (diagnostics::Events).
class Events
{
public:
    // Returns whether the event should be logged now.
    bool failure(const JsonValue &event, qint64 now);
    // recovered(): forgets the last failure; returns whether there was one.
    bool takeLast();
    std::optional<JsonValue> last() const { return m_last; }
    qint64 lastEmitted() const { return m_lastEmitted; }

private:
    std::optional<JsonValue> m_last;
    qint64 m_lastEmitted = 0;
};

// The process-wide event state (a static in Rust). Thread-safe.
void failure(const QString &code, std::optional<quint16> status, std::optional<qint64> retry,
             const std::optional<QString> &requestId);
void recovered();
std::optional<JsonValue> lastFailure();
qint64 lastEmitted();
// For the unit tests: start from a clean state and read the clock from here.
void resetForTests();
void setClockForTests(std::function<qint64()> clock);

// snapshot(): schemaVersion, capturedAt and the allowlisted status fields.
JsonValue snapshot(const JsonValue &status, qint64 now);

class Reporter
{
public:
    void observe(const JsonValue &status, const QString &path);

private:
    std::optional<qint64> m_lastWrite;
    bool m_writeFailed = false;
};

}   // namespace community::diagnostics
