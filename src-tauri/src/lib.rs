use dabar_core::Sermon;

#[tauri::command]
async fn process_sermon(youtube_url: String) -> Result<Sermon, String> {
    Ok(Sermon::queued(youtube_url))
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![process_sermon])
        .run(tauri::generate_context!())
        .expect("error while running Dabar desktop app");
}
