use tauri::{App, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub fn register(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    app.global_shortcut().on_shortcut("CommandOrControl+Shift+J", |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            if let Some(win) = app.get_webview_window("main") {
                if win.is_visible().unwrap_or(false) {
                    let _ = win.hide();
                } else {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        }
    })?;
    Ok(())
}
