use byte_unit::{Byte, Unit};
use std::fs;
use std::process::Command;
use tauri::AppHandle;
use tauri::Manager;
use tauri::State;

mod community_upload;
mod config;
mod idle_screen;
mod profiles;

use community_upload::{CommunityEnrollment, CommunityUploadRuntime, CommunityUploadStatus};

const DIAL_READY_MARKER: &str = "/run/meticulous-dial-ready";
const DIAL_HOME_READY_MARKER: &str = "/run/meticulous-dial-home-ready";

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn ready(app_handle: AppHandle) {
    println!("React is reporting ready!");
    let _ = fs::remove_file(DIAL_HOME_READY_MARKER);
    let Some(window) = app_handle.get_webview_window("main") else {
        eprintln!("Dial main window is unavailable");
        return;
    };
    #[cfg(not(debug_assertions))]
    {
        if let Err(error) = window.set_fullscreen(true) {
            eprintln!("Failed to make the Dial window fullscreen: {}", error);
            return;
        }
    }
    if let Err(error) = window.show() {
        eprintln!("Failed to show the Dial window: {}", error);
        return;
    }
    if let Err(error) = fs::write(DIAL_READY_MARKER, "ready\n") {
        eprintln!("Failed to write dial ready marker: {}", error);
    }
}

#[tauri::command]
fn home_ready() {
    println!("React profile home screen is reporting ready!");
    if let Err(error) = fs::write(DIAL_HOME_READY_MARKER, "ready\n") {
        eprintln!("Failed to write dial home ready marker: {}", error);
    }
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

#[tauri::command]
fn community_upload_status(service: State<'_, CommunityUploadRuntime>) -> CommunityUploadStatus {
    service.status()
}

#[tauri::command]
fn community_begin_enrollment(
    service: State<'_, CommunityUploadRuntime>,
    machine_serial: Option<String>,
) -> Result<CommunityEnrollment, String> {
    service.begin_enrollment(machine_serial)
}

#[tauri::command]
fn community_set_upload_paused(
    service: State<'_, CommunityUploadRuntime>,
    paused: bool,
) -> Result<(), String> {
    service.set_paused(paused)
}

#[tauri::command]
async fn community_disconnect(service: State<'_, CommunityUploadRuntime>) -> Result<(), String> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.disconnect())
        .await
        .map_err(|_| "Community disconnect task failed".to_string())?
}

#[tauri::command]
fn community_factory_reset_local(service: State<'_, CommunityUploadRuntime>) -> Result<(), String> {
    service.factory_reset_local()
}

#[tauri::command]
fn community_scan_history(service: State<'_, CommunityUploadRuntime>) -> Result<(), String> {
    service.request_history_scan()
}

fn parse_mem() -> Option<u64> {
    let output = Command::new("systemctl")
        .args(&[
            "show",
            "--property=MemoryCurrent",
            "meticulous-dial.service",
        ])
        .output();

    if let Ok(output) = output.as_ref() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(value) = stdout.strip_prefix("MemoryCurrent=") {
                if value.trim() == "[not set]" {
                    println!("Dial app memory current is not set. Not running?");
                    return None;
                }
                if let Ok(bytes) = value.trim().parse::<u64>() {
                    return Some(bytes);
                } else {
                    println!("Failed to parse memory value: {}", value);
                }
            } else {
                println!("Unexpected output format: {}", stdout);
            }
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            println!("Error executing systemctl: {}", stderr);
        }
    }
    println!("Couldn't get the current memory usage...");
    None
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
    let community_upload = CommunityUploadRuntime::initialize();
    community_upload.start();
    std::thread::spawn(|| {
        show_mem();
    });
    tauri::Builder::default()
        .manage(community_upload)
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
        .register_uri_scheme_protocol("idle-asset", |ctx, request| {
            idle_screen::asset_protocol_response(ctx.app_handle(), request)
        })
        .invoke_handler(tauri::generate_handler![
            ready,
            home_ready,
            get_profiles,
            idle_screen::list_idle_screen_packages,
            idle_screen::load_idle_screen_package,
            community_upload_status,
            community_begin_enrollment,
            community_set_upload_paused,
            community_disconnect,
            community_factory_reset_local,
            community_scan_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
