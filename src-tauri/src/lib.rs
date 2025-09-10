use tauri::Manager;
use tauri::AppHandle;

mod profiles;
mod config;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn ready(app_handle: AppHandle)  {
    println!("React is reporting ready!");
    let window = app_handle.get_webview_window("main").unwrap();
    #[cfg(not(debug_assertions))]
    {
        window.set_fullscreen(true).unwrap();
    }
    window.show().unwrap();
}

#[tauri::command]
fn get_profiles() -> Result<Vec<serde_json::Value>, String>  {
    let profiles = profiles::fetch_profiles();
    if profiles.is_ok() {
        println!("Profiles fetched successfully");
    } else {
        eprintln!("Failed to fetch profiles: {}", profiles.as_ref().err().unwrap());
    }
    profiles
}



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
      .setup(|_app| {
            #[cfg(debug_assertions)]
            {
            let window = _app.get_webview_window("main").unwrap();
            window.open_devtools();
            window.close_devtools();
            window.set_decorations(true);
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::new()                                                    // Add logging to tauri app
            .clear_targets()                                                                        // Remove al log targets 
            .target(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout,))      // add the terminal (stdout) as log target
            .build())
        .invoke_handler(tauri::generate_handler![ready, get_profiles])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
