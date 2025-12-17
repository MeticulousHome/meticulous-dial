use byte_unit::{Byte, Unit};
use memory_stats::memory_stats;
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

fn show_mem() {
    loop {
        if let Some(usage) = memory_stats() {
            let physical = Byte::from_u64(usage.physical_mem as u64).get_adjusted_unit(Unit::MiB);
            let virtual_mem = Byte::from_u64(usage.virtual_mem as u64).get_adjusted_unit(Unit::MiB);
            log::info!("Memory usage: Physical: {:#.1} || Virtual: {:#.1}", physical, virtual_mem);
            if physical.get_byte() > Byte::from_u64_with_unit(1000u64, Unit::MiB).unwrap() {
                log::warn!("High memory usage detected!");
                std::thread::sleep(std::time::Duration::from_secs(1));
            } else {
                std::thread::sleep(std::time::Duration::from_secs(10));
            }
        } else {
            println!("Couldn't get the current memory usage :(");
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
                window.open_devtools();
                window.close_devtools();
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
                .format(|out, message, record| {
                    out.finish(format_args!(
                    "[{}] {}",
                    record.level(),
                    message
                    ))
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![ready, get_profiles])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
