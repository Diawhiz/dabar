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

    let state = AppState::default();
    let app = routes::router(state)
        .layer(
            CorsLayer::new()
                .allow_origin([
                    "http://localhost:5173".parse()?,
                    "http://127.0.0.1:5173".parse()?,
                    "https://dabar-beta.vercel.app".parse()?,
                ])
                .allow_methods(Any)
                .allow_headers(Any),
        )
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
