#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
#[cfg(not(debug_assertions))]
use std::os::windows::process::CommandExt;

#[cfg(not(debug_assertions))]
fn wait_for_server() {
    use std::{thread, time::Duration, net::TcpStream};
    for _ in 0..30 {
        if TcpStream::connect("127.0.0.1:3000").is_ok() {
            return;
        }
        thread::sleep(Duration::from_secs(1));
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&data_dir).ok();

            #[cfg(not(debug_assertions))]
            {
                use std::process::Command;

                let resource_dir = app.path().resolve("resources", tauri::path::BaseDirectory::Resource)
                    .unwrap_or_else(|_| std::env::current_dir().unwrap());

                let server_entry = resource_dir.join("server").join("index.cjs");

                if server_entry.exists() {
                    let bundled_node = resource_dir.join("node").join("node.exe");
                    let node_cmd = if bundled_node.exists() {
                        bundled_node.to_string_lossy().to_string()
                    } else {
                        "node".to_string()
                    };

                    Command::new(node_cmd)
                        .arg(&server_entry)
                        .env("PORT", "3000")
                        .env("DATA_DIR", data_dir.to_string_lossy().to_string())
                        .env("TEMPLATE_PATH", resource_dir.join("templates").join("cv-template.html").to_string_lossy().to_string())
                        .current_dir(resource_dir.join("server"))
                        .creation_flags(0x08000000)
                        .spawn()
                        .expect("failed to start API server");

                    wait_for_server();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
