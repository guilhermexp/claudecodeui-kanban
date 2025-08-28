use axum::{
    extract::State,
    response::Json as ResponseJson,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::{
    app_state::AppState,
    executors::codex::CodexExecutor,
    models::ApiResponse,
};

#[derive(Debug, Deserialize)]
pub struct CodexChatRequest {
    pub message: String,
    pub project_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CodexChatResponse {
    pub response: String,
    pub success: bool,
}

pub async fn chat_with_codex(
    State(_state): State<AppState>,
    Json(payload): Json<CodexChatRequest>,
) -> ResponseJson<ApiResponse<CodexChatResponse>> {
    // Get working directory
    let working_dir = payload.project_path.clone()
        .or_else(|| std::env::current_dir().ok().map(|p| p.to_string_lossy().to_string()))
        .unwrap_or_else(|| "/tmp".to_string());

    // Create a simple executor instance for one-shot execution
    let mut executor = CodexExecutor::new_with_dir(working_dir);
    
    // Execute the command and capture output
    match executor.execute_command(&payload.message).await {
        Ok(output) => {
            ResponseJson(ApiResponse::success(CodexChatResponse {
                response: output,
                success: true,
            }))
        }
        Err(e) => {
            ResponseJson(ApiResponse::error(&format!("Failed to execute Codex: {}", e)))
        }
    }
}

pub fn codex_router() -> Router<AppState> {
    Router::new()
        .route("/chat", post(chat_with_codex))
}