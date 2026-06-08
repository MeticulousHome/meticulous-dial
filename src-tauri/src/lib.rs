use byte_unit::{Byte, Unit};
use std::process::Command;
use tauri::AppHandle;
use tauri::Manager;

mod config;
mod profiles;

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
        .invoke_handler(tauri::generate_handler![ready, get_profiles])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
