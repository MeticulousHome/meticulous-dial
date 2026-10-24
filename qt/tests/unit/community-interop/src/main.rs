// community-interop <status | enroll SERIAL | pause | reset | run SECONDS>
// Drives the Tauri Dial's community_upload.rs on $CONFIG_PATH/community-upload (with COMMUNITY_API_BASE
// and MACHINE_API_BASE, as the Dial reads them) and prints the status JSON on the last line (enroll
// prints the enrollment JSON before it).
#[path = "../../../../../src-tauri/src"]
mod tauri_src {
    #[allow(dead_code)]
    pub mod community_upload;
}
use tauri_src::community_upload;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let service = match community_upload::CommunityUploadService::new() {
        Ok(service) => service,
        Err(error) => {
            println!("{}", serde_json::json!({ "error": error }));
            return;
        }
    };
    match args.get(1).map(String::as_str) {
        Some("enroll") => {
            let enrollment = service.begin_enrollment(args.get(2).cloned()).unwrap();
            println!("{}", serde_json::to_string(&enrollment).unwrap());
        }
        Some("pause") => service.set_paused(true).unwrap(),
        Some("reset") => service.factory_reset_local().unwrap(),
        Some("run") => {
            let seconds: u64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(5);
            service.start();
            std::thread::sleep(std::time::Duration::from_secs(seconds));
        }
        _ => {}
    }
    println!("{}", serde_json::to_string(&service.status()).unwrap());
}
