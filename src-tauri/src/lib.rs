use byte_unit::{Byte, Unit};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use tauri::AppHandle;
use tauri::Manager;

mod config;
mod profiles;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DialResourceSnapshot {
    memory_current_mb: Option<f64>,
    cpu_percent: Option<f64>,
    system_memory_available_mb: Option<f64>,
    system_load_1m: Option<f64>,
    top_cpu_processes: Vec<ProcessResourceSnapshot>,
    top_memory_processes: Vec<ProcessResourceSnapshot>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessResourceSnapshot {
    process_name: String,
    executable: Option<String>,
    systemd_unit: Option<String>,
    cpu_percent: Option<f64>,
    memory_mb: f64,
}

#[derive(Clone, Copy)]
struct CpuSample {
    usage_ns: u64,
    sampled_at: Instant,
}

static PREVIOUS_CPU_SAMPLE: OnceLock<Mutex<Option<CpuSample>>> = OnceLock::new();

#[derive(Clone, Copy)]
struct ProcessCpuSample {
    ticks: u64,
    start_time_ticks: u64,
}

struct ProcessSamples {
    sampled_at: Instant,
    by_pid: HashMap<u32, ProcessCpuSample>,
}

struct RawProcessSnapshot {
    pid: u32,
    process_name: String,
    executable: Option<String>,
    systemd_unit: Option<String>,
    cpu: ProcessCpuSample,
    memory_mb: f64,
}

static PREVIOUS_PROCESS_SAMPLES: OnceLock<Mutex<Option<ProcessSamples>>> = OnceLock::new();
const PROCESS_RANKING_LIMIT: usize = 3;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn ready(app_handle: AppHandle) {
    println!("React is reporting ready!");
    let window = app_handle.get_webview_window("main").unwrap();
    #[cfg(not(debug_assertions))]
    {
        window.set_fullscreen(true).unwrap();
    }
    window.show().unwrap();
}

#[tauri::command]
fn get_profiles() -> Result<Vec<serde_json::Value>, String> {
    let profiles = profiles::fetch_profiles();
    if profiles.is_ok() {
        println!("Profiles fetched successfully");
    } else {
        eprintln!(
            "Failed to fetch profiles: {}",
            profiles.as_ref().err().unwrap()
        );
    }
    profiles
}

fn parse_mem() -> Option<u64> {
    read_service_properties().0
}

fn read_service_properties() -> (Option<u64>, Option<u64>) {
    let output = Command::new("systemctl")
        .args([
            "show",
            "--property=MemoryCurrent",
            "--property=CPUUsageNSec",
            "meticulous-dial.service",
        ])
        .output();

    if let Ok(output) = output.as_ref() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            return (
                parse_systemd_u64_property(&stdout, "MemoryCurrent"),
                parse_systemd_u64_property(&stdout, "CPUUsageNSec"),
            );
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            println!("Error executing systemctl: {}", stderr);
        }
    }
    println!("Couldn't get the current Dial resource usage...");
    (None, None)
}

fn parse_systemd_u64_property(output: &str, property: &str) -> Option<u64> {
    output.lines().find_map(|line| {
        let (key, value) = line.split_once('=')?;
        if key == property && value != "[not set]" {
            value.trim().parse::<u64>().ok()
        } else {
            None
        }
    })
}

fn calculate_cpu_percent(usage_ns: Option<u64>, sampled_at: Instant) -> Option<f64> {
    let usage_ns = usage_ns?;
    let samples = PREVIOUS_CPU_SAMPLE.get_or_init(|| Mutex::new(None));
    let mut previous = samples.lock().ok()?;
    let current = CpuSample {
        usage_ns,
        sampled_at,
    };

    let cpu_percent = previous.and_then(|sample| {
        let elapsed_ns = sampled_at.duration_since(sample.sampled_at).as_nanos();
        let usage_delta = usage_ns.checked_sub(sample.usage_ns)?;
        if elapsed_ns == 0 {
            return None;
        }
        Some((usage_delta as f64 / elapsed_ns as f64) * 100.0)
    });
    *previous = Some(current);
    cpu_percent
}

fn read_system_memory_available_mb() -> Option<f64> {
    let meminfo = fs::read_to_string("/proc/meminfo").ok()?;
    meminfo.lines().find_map(|line| {
        let value_kib = line.strip_prefix("MemAvailable:")?;
        let value_kib = value_kib.split_whitespace().next()?.parse::<u64>().ok()?;
        Some(value_kib as f64 / 1024.0)
    })
}

fn read_system_load_1m() -> Option<f64> {
    fs::read_to_string("/proc/loadavg")
        .ok()?
        .split_whitespace()
        .next()?
        .parse::<f64>()
        .ok()
}

fn parse_process_stat(stat: &str) -> Option<ProcessCpuSample> {
    // The comm field is parenthesized and may contain spaces or parentheses, so
    // parse fields after its final closing parenthesis.
    let fields: Vec<&str> = stat.rsplit_once(") ")?.1.split_whitespace().collect();
    let user_ticks = fields.get(11)?.parse::<u64>().ok()?;
    let system_ticks = fields.get(12)?.parse::<u64>().ok()?;
    let start_time_ticks = fields.get(19)?.parse::<u64>().ok()?;
    Some(ProcessCpuSample {
        ticks: user_ticks.checked_add(system_ticks)?,
        start_time_ticks,
    })
}

fn parse_memory_rss_mb(status: &str) -> Option<f64> {
    status.lines().find_map(|line| {
        let value = line.strip_prefix("VmRSS:")?;
        let kib = value.split_whitespace().next()?.parse::<u64>().ok()?;
        Some(kib as f64 / 1024.0)
    })
}

fn parse_systemd_unit(cgroup: &str) -> Option<String> {
    cgroup.lines().find_map(|line| {
        let path = line.splitn(3, ':').nth(2)?;
        path.split('/').rev().find_map(|segment| {
            if segment.ends_with(".service") || segment.ends_with(".scope") {
                Some(segment.to_owned())
            } else {
                None
            }
        })
    })
}

fn executable_name(path: PathBuf) -> Option<String> {
    path.file_name()?.to_str().map(str::to_owned)
}

fn read_process_snapshot(proc_root: &Path, pid: u32) -> Option<RawProcessSnapshot> {
    let process_root = proc_root.join(pid.to_string());
    let process_name = fs::read_to_string(process_root.join("comm"))
        .ok()?
        .trim()
        .to_owned();
    let cpu = parse_process_stat(&fs::read_to_string(process_root.join("stat")).ok()?)?;
    let memory_mb = parse_memory_rss_mb(&fs::read_to_string(process_root.join("status")).ok()?)?;
    let executable = fs::read_link(process_root.join("exe"))
        .ok()
        .and_then(executable_name);
    let systemd_unit = fs::read_to_string(process_root.join("cgroup"))
        .ok()
        .and_then(|value| parse_systemd_unit(&value));

    Some(RawProcessSnapshot {
        pid,
        process_name,
        executable,
        systemd_unit,
        cpu,
        memory_mb,
    })
}

fn clock_ticks_per_second() -> Option<f64> {
    // SAFETY: sysconf reads an immutable process-wide system setting.
    let ticks = unsafe { libc::sysconf(libc::_SC_CLK_TCK) };
    (ticks > 0).then_some(ticks as f64)
}

fn read_top_processes(
    sampled_at: Instant,
) -> (Vec<ProcessResourceSnapshot>, Vec<ProcessResourceSnapshot>) {
    let proc_root = Path::new("/proc");
    let current: Vec<RawProcessSnapshot> = match fs::read_dir(proc_root) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .filter_map(|entry| entry.file_name().to_str()?.parse::<u32>().ok())
            .filter_map(|pid| read_process_snapshot(proc_root, pid))
            .collect(),
        Err(_) => return (Vec::new(), Vec::new()),
    };

    let current_samples = current
        .iter()
        .map(|process| (process.pid, process.cpu))
        .collect::<HashMap<_, _>>();
    let samples = PREVIOUS_PROCESS_SAMPLES.get_or_init(|| Mutex::new(None));
    let Ok(mut previous) = samples.lock() else {
        return (Vec::new(), Vec::new());
    };
    let elapsed_seconds = previous
        .as_ref()
        .map(|sample| sampled_at.duration_since(sample.sampled_at).as_secs_f64());
    let ticks_per_second = clock_ticks_per_second();

    let mut snapshots = current
        .into_iter()
        .map(|process| {
            let cpu_percent = previous.as_ref().and_then(|samples| {
                let old = samples.by_pid.get(&process.pid)?;
                if old.start_time_ticks != process.cpu.start_time_ticks {
                    return None;
                }
                let tick_delta = process.cpu.ticks.checked_sub(old.ticks)?;
                let elapsed = elapsed_seconds?;
                let ticks_per_second = ticks_per_second?;
                (elapsed > 0.0).then_some(tick_delta as f64 / ticks_per_second / elapsed * 100.0)
            });
            ProcessResourceSnapshot {
                process_name: process.process_name,
                executable: process.executable,
                systemd_unit: process.systemd_unit,
                cpu_percent,
                memory_mb: process.memory_mb,
            }
        })
        .collect::<Vec<_>>();

    *previous = Some(ProcessSamples {
        sampled_at,
        by_pid: current_samples,
    });

    let mut by_memory = snapshots.clone();
    by_memory.sort_by(|left, right| right.memory_mb.total_cmp(&left.memory_mb));
    by_memory.truncate(PROCESS_RANKING_LIMIT);

    snapshots.retain(|process| process.cpu_percent.is_some());
    snapshots.sort_by(|left, right| {
        right
            .cpu_percent
            .unwrap_or_default()
            .total_cmp(&left.cpu_percent.unwrap_or_default())
    });
    snapshots.truncate(PROCESS_RANKING_LIMIT);
    (snapshots, by_memory)
}

#[tauri::command]
fn get_dial_resource_snapshot() -> DialResourceSnapshot {
    let sampled_at = Instant::now();
    let (memory_current, cpu_usage_ns) = read_service_properties();
    let (top_cpu_processes, top_memory_processes) = read_top_processes(sampled_at);
    DialResourceSnapshot {
        memory_current_mb: memory_current.map(|bytes| bytes as f64 / 1024.0 / 1024.0),
        cpu_percent: calculate_cpu_percent(cpu_usage_ns, sampled_at),
        system_memory_available_mb: read_system_memory_available_mb(),
        system_load_1m: read_system_load_1m(),
        top_cpu_processes,
        top_memory_processes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_process_stat_with_ambiguous_name() {
        let stat = "42 (Main worker) R 1 2 3 4 5 6 7 8 9 10 100 25 15 5 20 0 1 0 999";
        let sample = parse_process_stat(stat).unwrap();
        assert_eq!(sample.ticks, 125);
        assert_eq!(sample.start_time_ticks, 999);
    }

    #[test]
    fn extracts_systemd_unit_from_cgroup() {
        let cgroup = "0::/system.slice/meticulous-dial.service/webkit\n";
        assert_eq!(
            parse_systemd_unit(cgroup).as_deref(),
            Some("meticulous-dial.service")
        );
    }

    #[test]
    fn parses_resident_memory() {
        let status = "Name:\tMain\nVmRSS:\t  204800 kB\n";
        assert_eq!(parse_memory_rss_mb(status), Some(200.0));
    }
}

#[tauri::command]
fn dial_performance_debug_enabled() -> bool {
    std::env::var("DIAL_PERFORMANCE_DEBUG")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn show_mem() {
    loop {
        if let Some(physical) = parse_mem() {
            let physical = Byte::from_u64_with_unit(physical, Unit::B).unwrap();
            log::info!(
                "Current memory usage: {:#.1}",
                physical.get_adjusted_unit(Unit::MiB)
            );
            if physical > Byte::from_u64_with_unit(1000u64, Unit::MiB).unwrap() {
                log::warn!("High memory usage detected!");
                std::thread::sleep(std::time::Duration::from_secs(1));
            } else {
                std::thread::sleep(std::time::Duration::from_secs(10));
            }
        } else {
            std::thread::sleep(std::time::Duration::from_secs(30));
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::thread::spawn(|| {
        show_mem();
    });
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let window = _app.get_webview_window("main").unwrap();
                // NOTE: open_devtools()/close_devtools() keeps an inspector
                // backend connection alive, causing significant memory growth.
                // Only open devtools when actually needed for debugging.
                // window.open_devtools();
                // window.close_devtools();
                let _ = window.set_decorations(true);
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new() // Add logging to tauri app
                .clear_targets() // Remove al log targets
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Stdout,
                )) // add the terminal (stdout) as log target
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            ready,
            get_profiles,
            get_dial_resource_snapshot,
            dial_performance_debug_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
