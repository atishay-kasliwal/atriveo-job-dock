use tauri_plugin_opener::OpenerExt;

fn sanitize_folder_name(raw: &str) -> Option<String> {
    let mut cleaned = String::with_capacity(raw.len());
    let mut last_was_space = false;

    for ch in raw.trim().chars() {
        let normalized = match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => ' ',
            c if c.is_control() => ' ',
            c => c,
        };

        if normalized.is_whitespace() {
            if !last_was_space {
                cleaned.push(' ');
                last_was_space = true;
            }
        } else {
            cleaned.push(normalized);
            last_was_space = false;
        }
    }

    let trimmed = cleaned.trim_matches(|c: char| c == '.' || c.is_whitespace()).trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[tauri::command]
pub fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Where a source PDF lands under ~/Downloads, without touching the disk.
///
/// Shared by `save_to_downloads` (which then copies) and `downloads_status`
/// (which only reports), so the UI can never disagree with the writer about
/// which folder a resume belongs in.
fn resolve_dest(src_path: &str, folder_name: Option<&str>) -> Result<std::path::PathBuf, String> {
    let src = std::path::Path::new(src_path);
    let downloads = dirs::download_dir()
        .ok_or_else(|| "Could not find Downloads folder".to_string())?;

    // Prefer a caller-supplied clean folder name (e.g. "CharacterAi(12thJuly)");
    // fall back to the source folder's own name for backwards compatibility.
    let folder = folder_name
        .and_then(sanitize_folder_name)
        .unwrap_or_else(|| {
            src.parent()
                .and_then(|p| p.file_name())
                .and_then(|s| s.to_str())
                .unwrap_or("resume")
                .to_string()
        });
    let file_name = src.file_name().and_then(|s| s.to_str()).unwrap_or("Atishay Kasliwal.pdf");
    Ok(downloads.join(folder).join(file_name))
}

#[derive(serde::Serialize)]
pub struct DownloadsStatus {
    /// Absolute destination path (whether or not it exists yet).
    pub path: String,
    /// Same path with the home prefix folded back to `~`, for display.
    pub display_path: String,
    pub exists: bool,
}

/// Report whether a build's PDF is already sitting in the Downloads folder.
///
/// Deliberately does NOT require the source file to exist — a resume built on
/// another machine (or since cleaned up) can still have a saved copy here, and
/// the UI should say so.
#[tauri::command]
pub fn downloads_status(src_path: String, folder_name: Option<String>) -> Result<DownloadsStatus, String> {
    let dest = resolve_dest(&src_path, folder_name.as_deref())?;
    let path = dest.to_string_lossy().to_string();
    let display_path = dirs::home_dir()
        .and_then(|home| dest.strip_prefix(&home).ok().map(|rest| format!("~/{}", rest.display())))
        .unwrap_or_else(|| path.clone());
    Ok(DownloadsStatus { exists: dest.is_file(), path, display_path })
}

#[tauri::command]
pub fn save_to_downloads(src_path: String, folder_name: Option<String>) -> Result<String, String> {
    let src = std::path::Path::new(&src_path);
    if !src.exists() {
        return Err(format!("File not found: {src_path}"));
    }
    let dest = resolve_dest(&src_path, folder_name.as_deref())?;
    let dest_dir = dest.parent().ok_or_else(|| "Invalid destination".to_string())?;
    std::fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;

    std::fs::copy(src, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}
