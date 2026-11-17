#pragma once

// Disk side of the uploader, as community_upload.rs does it: private directories (0700), files written
// atomically (a 0600 temporary created exclusively, fsync, rename, fsync of the directory), the
// state.json load with its one-time migrations, and the cleanup of orphaned queue bodies.

#include "model.h"

#include <QByteArray>
#include <QString>

#include <optional>

namespace community::storage {

// create_private_dir: mkdir -p, then chmod 0700 on the directory itself.
bool createPrivateDir(const QString &path);
// write_private_file_atomic.
bool writePrivateFileAtomic(const QString &path, const QByteArray &bytes);
bool persistState(const QString &path, const PersistentState &state);
// load_or_create_state: reads and validates state.json (applying the Pour Over migrations, written back
// when they change something) or creates and writes a fresh state. nullopt on any error.
std::optional<PersistentState> loadOrCreateState(const QString &path, qint64 now);
// remove_orphaned_queue_files: deletes regular files in the queue directory that no queue item names.
bool removeOrphanedQueueFiles(const QString &queueDir, const QVector<QueuedShot> &queue);
// fs::metadata(path).len(), 0 when it cannot be read.
quint64 fileSize(const QString &path);

}   // namespace community::storage
