use tauri::{AppHandle, Emitter, Manager, Runtime, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const MAIN_WINDOW_LABEL: &str = "main";
const FOCUS_SEARCH_EVENT: &str = "notesflash://focus-search";

/// Reveal the compact NotesFlash window and hand keyboard focus back to the
/// search box. The frontend listens for `notesflash://focus-search` and focuses
/// the search input after the native window has been restored.
fn reveal_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.emit(FOCUS_SEARCH_EVENT, ());
}

fn default_global_shortcut() -> Shortcut {
    #[cfg(target_os = "macos")]
    let primary_modifier = Modifiers::SUPER;

    #[cfg(not(target_os = "macos"))]
    let primary_modifier = Modifiers::CONTROL;

    Shortcut::new(Some(primary_modifier | Modifiers::SHIFT), Code::Space)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // This plugin should remain the first registered plugin. A second app
        // launch simply reveals the already-running compact window.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            reveal_main_window(app);
        }))
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        reveal_main_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            if let Err(error) = app
                .global_shortcut()
                .register(default_global_shortcut())
            {
                // A conflicting system/app shortcut should not make the notes
                // window unusable. The app still starts and can be opened from
                // the Dock; the conflict is actionable from the terminal log.
                eprintln!("could not register CommandOrControl+Shift+Space: {error}");
                let _ = app.emit("notesflash://shortcut-error", error.to_string());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != MAIN_WINDOW_LABEL {
                return;
            }

            if let WindowEvent::CloseRequested { api, .. } = event {
                // Keep the process and global shortcut alive. Command-Q still
                // quits the application through the normal macOS lifecycle.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running NotesFlash");
}
