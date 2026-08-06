use byte_unit::{Byte, Unit};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri::Manager;

mod config;
mod profiles;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DialResourceSnapshot {
    collected_at_unix_ms: u64,
    collection_duration_ms: f64,
    process_scan_duration_ms: f64,
    memory_current_mb: Option<f64>,
    cpu_percent: Option<f64>,
    cpu_count: Option<usize>,
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
    memory_mb: Option<f64>,
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
    memory_mb: Option<f64>,
}

static PREVIOUS_PROCESS_SAMPLES: OnceLock<Mutex<Option<ProcessSamples>>> = OnceLock::new();
static RESOURCE_SNAPSHOT_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
const PROCESS_RANKING_LIMIT: usize = 3;
const MIN_CPU_SAMPLE_INTERVAL: Duration = Duration::from_secs(1);
const SYSTEMCTL_TIMEOUT: Duration = Duration::from_secs(2);
const CHILD_POLL_INTERVAL: Duration = Duration::from_millis(10);

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

fn command_output_with_timeout(
    command: &mut Command,
    timeout: Duration,
) -> std::io::Result<Option<Output>> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn()?;
    let started_at = Instant::now();

    loop {
        if let Some(status) = child.try_wait()? {
            let mut stdout = Vec::new();
            let mut stderr = Vec::new();
            if let Some(mut pipe) = child.stdout.take() {
                pipe.read_to_end(&mut stdout)?;
            }
            if let Some(mut pipe) = child.stderr.take() {
                pipe.read_to_end(&mut stderr)?;
            }
            return Ok(Some(Output {
                status,
                stdout,
                stderr,
            }));
        }

        if started_at.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Ok(None);
        }

        std::thread::sleep(CHILD_POLL_INTERVAL);
    }
}

fn read_service_properties() -> (Option<u64>, Option<u64>) {
    let mut command = Command::new("systemctl");
    command.args([
        "show",
        "--no-pager",
        "--property=MemoryCurrent",
        "--property=CPUUsageNSec",
        "meticulous-dial.service",
    ]);

    match command_output_with_timeout(&mut command, SYSTEMCTL_TIMEOUT) {
        Ok(Some(output)) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            (
                parse_systemd_u64_property(&stdout, "MemoryCurrent"),
                parse_systemd_u64_property(&stdout, "CPUUsageNSec"),
            )
        }
        Ok(Some(output)) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            println!("Error executing systemctl: {}", stderr);
            (None, None)
        }
        Ok(None) => {
            println!("Timed out reading Dial resource usage from systemctl");
            (None, None)
        }
        Err(error) => {
            println!("Couldn't execute systemctl: {}", error);
            (None, None)
        }
    }
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

fn calculate_cpu_percent_between(previous: CpuSample, current: CpuSample) -> Option<f64> {
    let elapsed = current
        .sampled_at
        .checked_duration_since(previous.sampled_at)?;
    if elapsed < MIN_CPU_SAMPLE_INTERVAL {
        return None;
    }
    let usage_delta = current.usage_ns.checked_sub(previous.usage_ns)?;
    let cpu_percent = usage_delta as f64 / elapsed.as_nanos() as f64 * 100.0;
    cpu_percent.is_finite().then_some(cpu_percent)
}

fn calculate_cpu_percent(usage_ns: Option<u64>, sampled_at: Instant) -> Option<f64> {
    let usage_ns = usage_ns?;
    let samples = PREVIOUS_CPU_SAMPLE.get_or_init(|| Mutex::new(None));
    let mut previous = samples
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let current = CpuSample {
        usage_ns,
        sampled_at,
    };

    let cpu_percent = previous.and_then(|sample| calculate_cpu_percent_between(sample, current));
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
    let memory_mb = fs::read_to_string(process_root.join("status"))
        .ok()
        .and_then(|status| parse_memory_rss_mb(&status));
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

fn read_top_processes() -> (Vec<ProcessResourceSnapshot>, Vec<ProcessResourceSnapshot>) {
    let proc_root = Path::new("/proc");
    let current: Vec<RawProcessSnapshot> = match fs::read_dir(proc_root) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .filter_map(|entry| entry.file_name().to_str()?.parse::<u32>().ok())
            .filter_map(|pid| read_process_snapshot(proc_root, pid))
            .collect(),
        Err(_) => return (Vec::new(), Vec::new()),
    };
    // Timestamp after the walk so the elapsed interval is not systematically
    // shortened by collection work performed under load.
    let sampled_at = Instant::now();

    let current_samples = current
        .iter()
        .map(|process| (process.pid, process.cpu))
        .collect::<HashMap<_, _>>();
    let samples = PREVIOUS_PROCESS_SAMPLES.get_or_init(|| Mutex::new(None));
    let mut previous = samples
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let elapsed_seconds = previous
        .as_ref()
        .and_then(|sample| sampled_at.checked_duration_since(sample.sampled_at))
        .filter(|elapsed| *elapsed >= MIN_CPU_SAMPLE_INTERVAL)
        .map(|elapsed| elapsed.as_secs_f64());
    let ticks_per_second = clock_ticks_per_second();

    let snapshots = current
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
                let cpu_percent = tick_delta as f64 / ticks_per_second / elapsed * 100.0;
                cpu_percent.is_finite().then_some(cpu_percent)
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

    rank_processes(snapshots)
}

fn rank_processes(
    mut snapshots: Vec<ProcessResourceSnapshot>,
) -> (Vec<ProcessResourceSnapshot>, Vec<ProcessResourceSnapshot>) {
    let mut by_memory = snapshots
        .iter()
        .filter(|process| process.memory_mb.is_some())
        .cloned()
        .collect::<Vec<_>>();
    by_memory.sort_by(|left, right| {
        right
            .memory_mb
            .unwrap_or_default()
            .total_cmp(&left.memory_mb.unwrap_or_default())
    });
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

fn unix_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn collect_dial_resource_snapshot() -> DialResourceSnapshot {
    let collection_started_at = Instant::now();
    let lock = RESOURCE_SNAPSHOT_LOCK.get_or_init(|| Mutex::new(()));
    let _guard = lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());

    let (memory_current, cpu_usage_ns) = read_service_properties();
    let service_sampled_at = Instant::now();
    let process_scan_started_at = Instant::now();
    let (top_cpu_processes, top_memory_processes) = read_top_processes();
    let process_scan_duration_ms = process_scan_started_at.elapsed().as_secs_f64() * 1_000.0;
    let cpu_percent = calculate_cpu_percent(cpu_usage_ns, service_sampled_at);
    let cpu_count = std::thread::available_parallelism()
        .ok()
        .map(std::num::NonZeroUsize::get);
    let system_memory_available_mb = read_system_memory_available_mb();
    let system_load_1m = read_system_load_1m();
    let collected_at_unix_ms = unix_time_ms();
    let collection_duration_ms = collection_started_at.elapsed().as_secs_f64() * 1_000.0;

    DialResourceSnapshot {
        collected_at_unix_ms,
        collection_duration_ms,
        process_scan_duration_ms,
        memory_current_mb: memory_current.map(|bytes| bytes as f64 / 1024.0 / 1024.0),
        cpu_percent,
        cpu_count,
        system_memory_available_mb,
        system_load_1m,
        top_cpu_processes,
        top_memory_processes,
    }
}

#[tauri::command]
async fn get_dial_resource_snapshot() -> Result<DialResourceSnapshot, String> {
    tauri::async_runtime::spawn_blocking(collect_dial_resource_snapshot)
        .await
        .map_err(|error| format!("Dial resource collection task failed: {error}"))
}

fn env_flag_enabled(name: &str) -> bool {
    std::env::var(name)
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

#[tauri::command]
fn dial_performance_debug_enabled() -> bool {
    env_flag_enabled("DIAL_PERFORMANCE_DEBUG")
}

#[tauri::command]
fn dial_performance_monitor_enabled() -> bool {
    !env_flag_enabled("DIAL_PERFORMANCE_DISABLE")
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
            dial_performance_monitor_enabled,
            dial_performance_debug_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_process_stat_with_ambiguous_name() {
        let stat = "42 (Main) worker) R 1 2 3 4 5 6 7 8 9 10 100 25 15 5 20 0 1 0 999";
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

    #[test]
    fn parses_systemd_numeric_property() {
        let output = "MemoryCurrent=1048576\nCPUUsageNSec=[not set]\n";
        assert_eq!(
            parse_systemd_u64_property(output, "MemoryCurrent"),
            Some(1_048_576)
        );
        assert_eq!(parse_systemd_u64_property(output, "CPUUsageNSec"), None);
    }

    #[test]
    fn cpu_percent_requires_a_real_sample_interval() {
        let sampled_at = Instant::now();
        let previous = CpuSample {
            usage_ns: 1_000_000_000,
            sampled_at,
        };
        let too_soon = CpuSample {
            usage_ns: 1_100_000_000,
            sampled_at: sampled_at + Duration::from_millis(100),
        };
        let valid = CpuSample {
            usage_ns: 2_000_000_000,
            sampled_at: sampled_at + Duration::from_secs(2),
        };

        assert_eq!(calculate_cpu_percent_between(previous, too_soon), None);
        assert_eq!(calculate_cpu_percent_between(previous, valid), Some(50.0));
    }

    fn process_snapshot(
        cpu_percent: Option<f64>,
        memory_mb: Option<f64>,
    ) -> ProcessResourceSnapshot {
        ProcessResourceSnapshot {
            process_name: "test".to_owned(),
            executable: None,
            systemd_unit: None,
            cpu_percent,
            memory_mb,
        }
    }

    #[test]
    fn ranks_cpu_and_memory_independently() {
        let snapshots = vec![
            process_snapshot(Some(10.0), None),
            process_snapshot(Some(40.0), Some(5.0)),
            process_snapshot(Some(20.0), Some(30.0)),
            process_snapshot(None, Some(50.0)),
        ];

        let (by_cpu, by_memory) = rank_processes(snapshots);
        assert_eq!(
            by_cpu
                .iter()
                .map(|process| process.cpu_percent.unwrap())
                .collect::<Vec<_>>(),
            vec![40.0, 20.0, 10.0]
        );
        assert_eq!(
            by_memory
                .iter()
                .map(|process| process.memory_mb.unwrap())
                .collect::<Vec<_>>(),
            vec![50.0, 30.0, 5.0]
        );
    }
}
