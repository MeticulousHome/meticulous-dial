use serde_json::Value;
use std::{
    env,
    fs,
    io::Read,
    path::{Path, PathBuf},
};
use crate::config;

fn profiles_dir() -> PathBuf {
    env::var("PROFILE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/meticulous-user/profiles"))
}

fn parse_json_file(path: &Path) -> Option<Value> {
    let mut file = fs::File::open(path).ok()?;
    let mut buf = String::new();
    file.read_to_string(&mut buf).ok()?;
    serde_json::from_str(&buf).ok()
}

pub fn scan_and_parse_profiles() -> Vec<Value> {
    let dir = profiles_dir();
    println!("Scanning profiles directory: {}", dir.display());
    let mut results = Vec::new();

    match fs::read_dir(&dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path
                        .extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.eq_ignore_ascii_case("json"))
                        .unwrap_or(false)
                {
                    match parse_json_file(&path) {
                        Some(v) => results.push(v),
                        None => eprintln!("Failed to parse JSON: {}", path.display()),
                    }
                }
            }
        }
        Err(e) => eprintln!("Unable to read profiles directory {}: {}", dir.display(), e),
    }

    results
}

pub fn fetch_profiles() -> Vec<Value> {
    let mut profiles = scan_and_parse_profiles();
    let config = config::parse_config();
    if config.is_err() {
        eprintln!("Failed to parse config: {}", config.unwrap_err());
        return profiles;
    }
    let profile_order = config.unwrap().user.profile_order;
    if !profile_order.is_empty() {
        profiles.sort_by_key(|p| {
            profile_order
                .iter()
                .position(|id| p.get("id").and_then(Value::as_str) == Some(id))
                .unwrap_or(usize::MAX)
        });
    }

    profiles
}