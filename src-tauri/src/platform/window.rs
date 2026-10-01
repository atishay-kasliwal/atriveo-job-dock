use tauri::WebviewWindow;

#[tauri::command]
pub fn hide_window(window: WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
pub fn show_window(window: WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
pub fn toggle_always_on_top(window: WebviewWindow) {
    let current = window.is_always_on_top().unwrap_or(false);
    let _ = window.set_always_on_top(!current);
}
