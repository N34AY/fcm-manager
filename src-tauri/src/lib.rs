mod fmc;

use fmc::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fmc::get_connection,
            fmc::set_connection,
            fmc::login,
            fmc::list_domains,
            fmc::list_dynamic_objects,
            fmc::get_dynamic_object,
            fmc::create_dynamic_object,
            fmc::get_mappings,
            fmc::add_mapping,
            fmc::remove_mapping,
            fmc::list_devices,
            fmc::get_policy_threat_usage,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
