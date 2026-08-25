use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime, http};

const BUILTIN_IDS: [&str; 3] = ["default", "digital", "metCat"];
const RESERVED_IDS: [&str; 5] = ["default", "digital", "metCat", "dvd", "baristaBarista"];
const CUSTOM_ROOT: &str = "/meticulous-user/idle-screens";
const MAX_ASSETS: usize = 125;
const MAX_ASSET_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IdleScreenMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub package_hash: String,
    pub built_in: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdleScreenDefinition {
    pub metadata: IdleScreenMetadata,
    pub manifest: Manifest,
    pub screen: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub document_type: String,
    pub package_format: u8,
    pub id: String,
    pub name: String,
    pub version: String,
    pub runtime_api: u8,
    pub description: Option<String>,
    pub author: Option<String>,
    pub screen: String,
    pub preview: String,
    pub assets: Vec<ManifestAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestAsset {
    pub id: String,
    pub path: String,
    pub kind: String,
    pub mime_type: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Debug, Clone)]
struct ValidatedPackage {
    root: PathBuf,
    metadata: IdleScreenMetadata,
    manifest: Manifest,
    screen: Value,
    assets: HashMap<String, ManifestAsset>,
}

#[tauri::command]
pub fn list_idle_screen_packages<R: Runtime>(
    app_handle: AppHandle<R>,
) -> Result<Vec<IdleScreenMetadata>, String> {
    let mut packages = Vec::new();
    for package in scan_packages(&app_handle)? {
        packages.push(package.metadata);
    }
    packages.sort_by(|a, b| {
        (u8::from(!a.built_in), a.name.to_lowercase())
            .cmp(&(u8::from(!b.built_in), b.name.to_lowercase()))
    });
    Ok(packages)
}

#[tauri::command]
pub fn load_idle_screen_package<R: Runtime>(
    app_handle: AppHandle<R>,
    id: String,
) -> Result<IdleScreenDefinition, String> {
    find_package(&app_handle, &id)?
        .map(|package| IdleScreenDefinition {
            metadata: package.metadata,
            manifest: package.manifest,
            screen: package.screen,
        })
        .ok_or_else(|| "idle screen package is unavailable".to_string())
}

pub fn asset_protocol_response<R: Runtime>(
    app_handle: &AppHandle<R>,
    request: http::Request<Vec<u8>>,
) -> http::Response<Vec<u8>> {
    match resolve_asset_request(app_handle, request.uri().path()) {
        Ok((bytes, mime_type)) => http::Response::builder()
            .status(http::StatusCode::OK)
            .header(http::header::CONTENT_TYPE, mime_type)
            .header(
                http::header::CACHE_CONTROL,
                "public, max-age=31536000, immutable",
            )
            .body(bytes)
            .unwrap(),
        Err(_) => http::Response::builder()
            .status(http::StatusCode::NOT_FOUND)
            .header(http::header::CONTENT_TYPE, "text/plain")
            .body(Vec::new())
            .unwrap(),
    }
}

fn resolve_asset_request<R: Runtime>(
    app_handle: &AppHandle<R>,
    request_path: &str,
) -> Result<(Vec<u8>, String), String> {
    let segments: Vec<String> = request_path
        .trim_start_matches('/')
        .split('/')
        .map(percent_decode)
        .collect::<Result<Vec<_>, _>>()?;
    if segments.len() != 3 {
        return Err("invalid idle asset request".to_string());
    }

    let package_id = &segments[0];
    let package_hash = &segments[1];
    let asset_id = &segments[2];
    if !is_sha256(package_hash) || !is_asset_id(asset_id) {
        return Err("invalid idle asset identifiers".to_string());
    }

    let package = find_package(app_handle, package_id)?
        .ok_or_else(|| "idle asset package is unavailable".to_string())?;
    if package.metadata.package_hash != *package_hash {
        return Err("idle asset package hash mismatch".to_string());
    }
    let asset = package
        .assets
        .get(asset_id)
        .ok_or_else(|| "idle asset is undeclared".to_string())?;
    let path = safe_join(&package.root, &asset.path)?;
    let canonical_root = canonicalize_existing(&package.root)?;
    let canonical_path = canonicalize_existing(&path)?;
    if !canonical_path.starts_with(canonical_root) {
        return Err("idle asset escaped package root".to_string());
    }
    let bytes = fs::read(canonical_path).map_err(|error| error.to_string())?;
    Ok((bytes, asset.mime_type.clone()))
}

fn scan_packages<R: Runtime>(app_handle: &AppHandle<R>) -> Result<Vec<ValidatedPackage>, String> {
    let mut packages = Vec::new();
    let mut built_in_ids = HashSet::new();

    for id in BUILTIN_IDS {
        built_in_ids.insert(id.to_string());
        let root = builtins_root(app_handle).join(id);
        match validate_package_root(&root, true) {
            Ok(package) => packages.push(package),
            Err(error) => eprintln!("Invalid built-in idle screen package {id}: {error}"),
        }
    }

    let custom_root = custom_root();
    if let Ok(entries) = fs::read_dir(&custom_root) {
        for entry in entries.flatten() {
            let root = entry.path();
            if !root.is_dir() {
                continue;
            }
            match validate_package_root(&root, false) {
                Ok(package) => {
                    if built_in_ids.contains(&package.metadata.id)
                        || RESERVED_IDS.contains(&package.metadata.id.as_str())
                    {
                        continue;
                    }
                    packages.push(package);
                }
                Err(error) => {
                    eprintln!(
                        "Invalid custom idle screen package {}: {error}",
                        root.display()
                    );
                }
            }
        }
    }

    Ok(packages)
}

fn find_package<R: Runtime>(
    app_handle: &AppHandle<R>,
    id: &str,
) -> Result<Option<ValidatedPackage>, String> {
    if BUILTIN_IDS.contains(&id) {
        let root = builtins_root(app_handle).join(id);
        return validate_package_root(&root, true).map(Some);
    }

    if RESERVED_IDS.contains(&id) || !id.starts_with("custom:") {
        return Ok(None);
    }

    let Some(slug) = id.strip_prefix("custom:") else {
        return Ok(None);
    };
    if !is_custom_slug(slug) {
        return Ok(None);
    }
    let root = custom_root().join(slug);
    if !root.is_dir() {
        return Ok(None);
    }
    validate_package_root(&root, false).map(Some)
}

fn validate_package_root(root: &Path, built_in: bool) -> Result<ValidatedPackage, String> {
    let manifest_path = root.join("manifest.json");
    let manifest_bytes = fs::read(&manifest_path).map_err(|error| error.to_string())?;
    let manifest: Manifest =
        serde_json::from_slice(&manifest_bytes).map_err(|error| error.to_string())?;
    validate_manifest(&manifest, built_in)?;

    let screen_path = safe_join(root, &manifest.screen)?;
    let preview_path = safe_join(root, &manifest.preview)?;
    let screen_bytes = fs::read(&screen_path).map_err(|error| error.to_string())?;
    let screen: Value = serde_json::from_slice(&screen_bytes).map_err(|error| error.to_string())?;
    validate_screen_header(&screen, &manifest)?;
    if !preview_path.is_file() {
        return Err("preview.png is missing".to_string());
    }

    let mut assets = HashMap::new();
    let mut paths = HashSet::new();
    let mut ids = HashSet::new();
    for asset in &manifest.assets {
        validate_asset_record(asset)?;
        if !ids.insert(asset.id.clone()) {
            return Err("duplicate asset id".to_string());
        }
        if !paths.insert(asset.path.clone()) {
            return Err("duplicate asset path".to_string());
        }
        let asset_path = safe_join(root, &asset.path)?;
        let metadata = fs::metadata(&asset_path).map_err(|error| error.to_string())?;
        if !metadata.is_file() || metadata.len() != asset.size {
            return Err(format!("asset {} metadata mismatch", asset.id));
        }
        let digest = sha256_file(&asset_path)?;
        if digest != asset.sha256 {
            return Err(format!("asset {} hash mismatch", asset.id));
        }
        assets.insert(asset.id.clone(), asset.clone());
    }

    let package_hash = package_hash(root, &manifest)?;
    Ok(ValidatedPackage {
        root: root.to_path_buf(),
        metadata: IdleScreenMetadata {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            package_hash,
            built_in,
        },
        manifest,
        screen,
        assets,
    })
}

fn validate_manifest(manifest: &Manifest, built_in: bool) -> Result<(), String> {
    if manifest.document_type != "meticulous-idle-manifest"
        || manifest.package_format != 1
        || manifest.runtime_api != 1
        || manifest.screen != "screen.json"
        || manifest.preview != "preview.png"
        || manifest.assets.len() > MAX_ASSETS
    {
        return Err("manifest header is unsupported".to_string());
    }

    if !is_package_id(&manifest.id) {
        return Err("manifest id is invalid".to_string());
    }
    if built_in && !BUILTIN_IDS.contains(&manifest.id.as_str()) {
        return Err("built-in manifest id is not reserved".to_string());
    }
    if !built_in && !manifest.id.starts_with("custom:") {
        return Err("custom manifest id must use custom: prefix".to_string());
    }
    if !is_semver(&manifest.version) || manifest.name.is_empty() || manifest.name.len() > 80 {
        return Err("manifest metadata is invalid".to_string());
    }
    Ok(())
}

fn validate_asset_record(asset: &ManifestAsset) -> Result<(), String> {
    if !is_asset_id(&asset.id)
        || !is_asset_path(&asset.path)
        || !is_sha256(&asset.sha256)
        || asset.size == 0
        || asset.size > MAX_ASSET_BYTES
    {
        return Err("asset record is invalid".to_string());
    }
    match (asset.kind.as_str(), asset.mime_type.as_str()) {
        ("image", "image/png" | "image/jpeg" | "image/webp") => Ok(()),
        ("font", "font/woff2") => Ok(()),
        ("lottie", "application/vnd.meticulous.lottie+json") => Ok(()),
        _ => Err("asset kind and mime type are inconsistent".to_string()),
    }
}

fn validate_screen_header(screen: &Value, manifest: &Manifest) -> Result<(), String> {
    let object = screen
        .as_object()
        .ok_or_else(|| "screen.json must be an object".to_string())?;
    if object.get("documentType").and_then(Value::as_str) != Some("meticulous-idle-screen")
        || object.get("schemaVersion").and_then(Value::as_i64) != Some(2)
        || object.get("runtimeApi").and_then(Value::as_i64) != Some(1)
        || object.get("id").and_then(Value::as_str) != Some(manifest.id.as_str())
    {
        return Err("screen header does not match manifest".to_string());
    }
    Ok(())
}

fn package_hash(root: &Path, manifest: &Manifest) -> Result<String, String> {
    let mut hasher = Sha256::new();
    for relative in package_files(manifest) {
        hasher.update(relative.as_bytes());
        hasher.update([0]);
        let bytes = fs::read(safe_join(root, &relative)?).map_err(|error| error.to_string())?;
        hasher.update(bytes);
        hasher.update([0]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn package_files(manifest: &Manifest) -> Vec<String> {
    let mut files = vec![
        "manifest.json".to_string(),
        manifest.screen.clone(),
        manifest.preview.clone(),
    ];
    files.extend(manifest.assets.iter().map(|asset| asset.path.clone()));
    files.sort();
    files
}

fn builtins_root<R: Runtime>(app_handle: &AppHandle<R>) -> PathBuf {
    if let Ok(root) = app_handle.path().resource_dir() {
        let bundled = root.join("resources").join("idle-screens");
        if bundled.exists() {
            return bundled;
        }
        let direct = root.join("idle-screens");
        if direct.exists() {
            return direct;
        }
    }

    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let from_repo = cwd.join("src-tauri").join("resources").join("idle-screens");
    if from_repo.exists() {
        return from_repo;
    }
    cwd.join("resources").join("idle-screens")
}

fn custom_root() -> PathBuf {
    std::env::var("METICULOUS_IDLE_SCREENS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(CUSTOM_ROOT))
}

fn safe_join(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative);
    if path.is_absolute() {
        return Err("absolute package path is not allowed".to_string());
    }
    for component in path.components() {
        if !matches!(component, Component::Normal(_)) {
            return Err("package path traversal is not allowed".to_string());
        }
    }
    Ok(root.join(path))
}

fn canonicalize_existing(path: &Path) -> Result<PathBuf, String> {
    path.canonicalize().map_err(|error| error.to_string())
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 16 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn percent_decode(value: &str) -> Result<String, String> {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if i + 2 >= bytes.len() {
                return Err("invalid percent encoding".to_string());
            }
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3])
                .map_err(|_| "invalid percent encoding".to_string())?;
            let byte =
                u8::from_str_radix(hex, 16).map_err(|_| "invalid percent encoding".to_string())?;
            output.push(byte);
            i += 3;
        } else {
            output.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(output).map_err(|_| "invalid utf-8 in path".to_string())
}

fn is_package_id(value: &str) -> bool {
    matches!(
        value,
        "default" | "digital" | "metCat" | "dvd" | "baristaBarista"
    ) || value
        .strip_prefix("custom:")
        .map(is_custom_slug)
        .unwrap_or(false)
}

fn is_custom_slug(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 72
        && value
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        && value
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '_' | '-'))
}

fn is_asset_path(value: &str) -> bool {
    value.starts_with("assets/")
        && value.len() >= 8
        && value.len() <= 180
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '/' | '-'))
        && !value
            .split('/')
            .any(|part| part == "." || part == ".." || part.is_empty())
}

fn is_asset_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic())
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .chars()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}

fn is_semver(value: &str) -> bool {
    let base = value.split_once('-').map(|(base, _)| base).unwrap_or(value);
    let parts: Vec<&str> = base.split('.').collect();
    parts.len() == 3
        && parts.iter().all(|part| {
            !part.is_empty()
                && part.chars().all(|c| c.is_ascii_digit())
                && (*part == "0" || !part.starts_with('0'))
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("idle-screen-{name}-{nonce}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn rejects_traversal_asset_paths() {
        assert!(safe_join(Path::new("/tmp/root"), "assets/image.png").is_ok());
        assert!(safe_join(Path::new("/tmp/root"), "assets/../secret.png").is_err());
        assert!(safe_join(Path::new("/tmp/root"), "/tmp/secret.png").is_err());
    }

    #[test]
    fn validates_manifest_asset_hashes() {
        let root = temp_dir("hash");
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(root.join("preview.png"), b"preview").unwrap();
        fs::write(root.join("assets/a.png"), b"image").unwrap();
        let hash = format!("{:x}", Sha256::digest(b"image"));
        fs::write(
            root.join("manifest.json"),
            format!(
                r#"{{
                  "documentType":"meticulous-idle-manifest","packageFormat":1,"id":"custom:test",
                  "name":"Test","version":"1.0.0","runtimeApi":1,"screen":"screen.json",
                  "preview":"preview.png","assets":[{{"id":"asset","path":"assets/a.png","kind":"image","mimeType":"image/png","size":5,"sha256":"{hash}"}}]
                }}"#
            ),
        )
        .unwrap();
        fs::write(
            root.join("screen.json"),
            r#"{"documentType":"meticulous-idle-screen","schemaVersion":2,"runtimeApi":1,"id":"custom:test"}"#,
        )
        .unwrap();

        assert!(validate_package_root(&root, false).is_ok());
        fs::write(root.join("assets/a.png"), b"other").unwrap();
        assert!(validate_package_root(&root, false).is_err());
    }
}
