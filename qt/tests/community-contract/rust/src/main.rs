// The Tauri side of the Community contract test (see ../../run.sh and ../../contract.py).
//
// Runs the Tauri Dial's own src-tauri/src/community_upload.rs as the Dial does (lib.rs: setup()
// initializes the CommunityUploadRuntime and starts its worker; the six community_* commands call it) on
// $CONFIG_PATH/community-upload with COMMUNITY_API_BASE and MACHINE_API_BASE. Reads one command per line
// on stdin and answers each with one "@@ <json>" line on stdout ({"ok": value} or {"error": message}, the
// Tauri command result). The uploader's log lines go to stderr as "LOG <level> <message>".
//
//   status | enroll <json string or null> | pause <true|false> | disconnect | reset | scan | quit
#[path = "../../../../../src-tauri/src"]
mod tauri_src {
    #[allow(dead_code)]
    pub mod community_upload;
}

use serde_json::{Value, json};
use std::io::{BufRead, Write};
use tauri_src::community_upload::CommunityUploadRuntime;

struct StderrLog;

impl log::Log for StderrLog {
    fn enabled(&self, metadata: &log::Metadata<'_>) -> bool {
        metadata.level() <= log::Level::Info && metadata.target().contains("community_upload")
    }
    fn log(&self, record: &log::Record<'_>) {
        if self.enabled(record.metadata()) {
            eprintln!("LOG {} {}", record.level().as_str().to_lowercase(), record.args());
        }
    }
    fn flush(&self) {}
}

static LOGGER: StderrLog = StderrLog;

fn reply(value: Value) {
    let mut out = std::io::stdout().lock();
    writeln!(out, "@@ {value}").unwrap();
    out.flush().unwrap();
}

fn result<T: serde::Serialize>(value: Result<T, String>) -> Value {
    match value {
        Ok(value) => json!({ "ok": value }),
        Err(error) => json!({ "error": error }),
    }
}

fn main() {
    // Never the production server: the contract test always points both bases at its local fakes.
    for name in ["COMMUNITY_API_BASE", "MACHINE_API_BASE"] {
        let value = std::env::var(name).unwrap_or_default();
        if !value.starts_with("http://127.0.0.1:") {
            eprintln!("{name} must point at the local fake server (got {value:?})");
            std::process::exit(2);
        }
    }
    log::set_logger(&LOGGER).unwrap();
    log::set_max_level(log::LevelFilter::Info);

    // lib.rs setup(): CommunityUploadRuntime::initialize(), manage, start().
    let runtime = CommunityUploadRuntime::initialize();
    runtime.start();
    reply(json!({ "ready": true }));

    for line in std::io::stdin().lock().lines() {
        let line = line.unwrap();
        let (command, argument) = line.split_once(' ').unwrap_or((line.as_str(), ""));
        let answer = match command {
            // community_upload_status
            "status" => json!({ "ok": runtime.status() }),
            // community_begin_enrollment (React passes machineSerial || null)
            "enroll" => {
                let serial: Option<String> = serde_json::from_str(argument).unwrap();
                result(runtime.begin_enrollment(serial))
            }
            // community_set_upload_paused
            "pause" => result(runtime.set_paused(argument == "true")),
            // community_disconnect (spawn_blocking in lib.rs: blocking here as well)
            "disconnect" => result(runtime.disconnect()),
            // community_factory_reset_local
            "reset" => result(runtime.factory_reset_local()),
            // community_scan_history
            "scan" => result(runtime.request_history_scan()),
            "quit" => {
                reply(json!({ "ok": null }));
                std::process::exit(0);
            }
            other => json!({ "error": format!("unknown command {other}") }),
        };
        reply(answer);
    }
}
