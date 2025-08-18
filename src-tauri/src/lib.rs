use tauri::Manager;
use tauri::AppHandle;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
      .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            #[cfg(debug_assertions)]
            {
            window.open_devtools();
            window.close_devtools();
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ready])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
