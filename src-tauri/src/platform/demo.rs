use tauri::Manager;

/// The sample resume that demo-mode builds resolve to, bundled as a resource.
#[tauri::command]
pub fn demo_resume_path(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .resolve("resources/demo-resume.pdf", tauri::path::BaseDirectory::Resource)
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

/// Launch with ATRIVEO_DOCK_TOUR=1 to autoplay the scripted demo tour.
#[tauri::command]
pub fn tour_enabled() -> bool {
    std::env::var_os("ATRIVEO_DOCK_TOUR").is_some()
}
