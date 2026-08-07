mod routes;
mod state;

use anyhow::Context;
use state::AppState;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "dabar_server=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    check_external_dependencies().await;

    let state = AppState::connect().await?;
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = routes::router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let port = std::env::var("PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::info!("dabar-server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("binding server to {addr}"))?;
    axum::serve(listener, app)
        .await
        .context("serving Axum app")?;
    Ok(())
}

async fn check_external_dependencies() {
    let yt_dlp_path = std::env::var("YT_DLP_PATH").unwrap_or_else(|_| "yt-dlp".to_string());
    match dabar_core::downloader::check_yt_dlp_installed().await {
        Ok(version) => tracing::info!("yt-dlp binary verified (version: {version})"),
        Err(err) => tracing::error!(
            "yt-dlp check failed (path: '{yt_dlp_path}'): {err:?}. Install yt-dlp on system PATH or set YT_DLP_PATH env var."
        ),
    }

    let ffmpeg_path = std::env::var("FFMPEG_PATH").unwrap_or_else(|_| "ffmpeg".to_string());
    match dabar_core::ffmpeg::check_ffmpeg_installed().await {
        Ok(version) => tracing::info!("ffmpeg binary verified ({version})"),
        Err(err) => tracing::error!(
            "ffmpeg check failed (path: '{ffmpeg_path}'): {err:?}. Install ffmpeg on system PATH or set FFMPEG_PATH env var."
        ),
    }
}
