#include "storage.h"

#include "crypto.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QSet>

#include <cerrno>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

namespace community::storage {

bool createPrivateDir(const QString &path)
{
    if (!QDir().mkpath(path))
        return false;
    return ::chmod(QFile::encodeName(path).constData(), 0700) == 0;
}

static bool writeAll(int fd, const QByteArray &bytes)
{
    const char *data = bytes.constData();
    qsizetype left = bytes.size();
    while (left > 0) {
        const ssize_t written = ::write(fd, data, size_t(left));
        if (written < 0) {
            if (errno == EINTR)
                continue;
            return false;
        }
        data += written;
        left -= written;
    }
    return true;
}

bool writePrivateFileAtomic(const QString &path, const QByteArray &bytes)
{
    const QFileInfo info(path);
    const QString parent = info.path();
    if (parent.isEmpty() || !createPrivateDir(parent))
        return false;
    const QString fileName = info.fileName().isEmpty() ? QStringLiteral("state") : info.fileName();
    const QString temporaryPath =
        parent + QStringLiteral("/.") + fileName + QLatin1Char('.') + crypto::newUuid() + QStringLiteral(".tmp");
    const QByteArray temporary = QFile::encodeName(temporaryPath);
    const int fd = ::open(temporary.constData(), O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC, 0600);
    if (fd < 0)
        return false;
    const bool written = writeAll(fd, bytes) && ::fsync(fd) == 0;
    const bool closed = ::close(fd) == 0;
    if (!written || !closed || ::rename(temporary.constData(), QFile::encodeName(path).constData()) != 0) {
        // The Rust version leaves the temporary behind; removing it keeps the directory clean.
        ::unlink(temporary.constData());
        return false;
    }
    const int dirFd = ::open(QFile::encodeName(parent).constData(), O_RDONLY | O_DIRECTORY | O_CLOEXEC);
    if (dirFd < 0)
        return false;
    const bool synced = ::fsync(dirFd) == 0;
    ::close(dirFd);
    return synced;
}

bool persistState(const QString &path, const PersistentState &state)
{
    return writePrivateFileAtomic(path, serializeState(state));
}

std::optional<PersistentState> loadOrCreateState(const QString &path, qint64 now)
{
    if (QFileInfo::exists(path)) {
        QFile file(path);
        if (!file.open(QIODevice::ReadOnly))
            return std::nullopt;
        const QByteArray bytes = file.readAll();
        if (file.error() != QFileDevice::NoError)
            return std::nullopt;
        auto state = parseState(bytes);
        if (!state || !validateState(*state))
            return std::nullopt;
        const bool reactivated = reactivateDeploymentBlockedPourOvers(*state, now) > 0;
        const bool replayScheduled = scheduleFractionalSampleRejectionReplay(*state, now);
        if ((reactivated || replayScheduled) && !persistState(path, *state))
            return std::nullopt;
        return state;
    }
    auto state = freshState();
    if (!state || !persistState(path, *state))
        return std::nullopt;
    return state;
}

bool removeOrphanedQueueFiles(const QString &queueDir, const QVector<QueuedShot> &queue)
{
    QSet<QString> expected;
    for (const QueuedShot &item : queue)
        expected.insert(item.bodyFile);
    QDir dir(queueDir);
    if (!dir.exists())
        return false;
    const QFileInfoList entries = dir.entryInfoList(QDir::Files | QDir::Hidden | QDir::System | QDir::NoDotAndDotDot);
    for (const QFileInfo &entry : entries) {
        // DirEntry::file_type() does not follow symlinks: only regular files are removed.
        struct stat st;
        if (::lstat(QFile::encodeName(entry.filePath()).constData(), &st) != 0)
            return false;
        if (!S_ISREG(st.st_mode) || expected.contains(entry.fileName()))
            continue;
        if (::unlink(QFile::encodeName(entry.filePath()).constData()) != 0)
            return false;
    }
    return true;
}

quint64 fileSize(const QString &path)
{
    struct stat st;
    if (::stat(QFile::encodeName(path).constData(), &st) != 0)
        return 0;
    return quint64(st.st_size);
}

}   // namespace community::storage
