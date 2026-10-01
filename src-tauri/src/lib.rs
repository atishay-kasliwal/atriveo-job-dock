mod platform;

use tauri::{LogicalPosition, LogicalSize, Manager, Position, Size};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            platform::demo::demo_resume_path,
            platform::demo::tour_enabled,
            platform::window::hide_window,
            platform::window::show_window,
            platform::window::toggle_always_on_top,
            platform::shell::open_url,
            platform::shell::save_to_downloads,
            platform::shell::downloads_status,
        ])
        .setup(|app| {
            let win = app.get_webview_window("main").unwrap();

            if let Ok(Some(monitor)) = win.current_monitor() {
                let scale    = monitor.scale_factor();
                let screen_h = monitor.size().height as f64 / scale;

                // Move to top-left; macOS will push the window below the menu bar.
                let _ = win.set_position(Position::Logical(LogicalPosition { x: 0.0, y: 0.0 }));

                // Read the actual y the OS settled on (= menu-bar height in logical px).
                let menu_bar_h = win
                    .outer_position()
                    .map(|p| (p.y as f64 / scale).max(0.0))
                    .unwrap_or(38.0); // safe fallback for modern Macs

                // Height = visible screen area below the menu bar.
                let available_h = screen_h - menu_bar_h;

                let _ = win.set_size(Size::Logical(LogicalSize {
                    width:  400.0,
                    height: available_h,
                }));
            }

            #[cfg(target_os = "macos")]
            {
                // Tauri's own vibrancy rather than a second window-vibrancy copy:
                // both registered NSVisualEffectViewTagged, a duplicate ObjC class.
                // Failing only loses the frosted background, so don't abort launch.
                use tauri::window::{Effect, EffectsBuilder};
                if let Err(e) = win.set_effects(EffectsBuilder::new().effect(Effect::HudWindow).build()) {
                    eprintln!("vibrancy unavailable: {e}");
                }
            }

            platform::shortcuts::register(app)?;
            platform::tray::setup(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
