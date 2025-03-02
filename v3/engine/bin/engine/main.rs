use axum::{
    body::HttpBody,
    extract::State,
    http::{HeaderMap, Request},
    middleware::Next,
    response::{Html, IntoResponse},
    routing::{get, post},
    Extension, Json, Router,
};
use clap::Parser;

use ::engine::authentication::{AuthConfig, AuthConfig::V1 as V1AuthConfig, AuthModeConfig};
use engine::schema::GDS;
use hasura_authn_core::Session;
use hasura_authn_jwt::auth as jwt_auth;
use hasura_authn_jwt::jwt;
use hasura_authn_webhook::webhook;
use lang_graphql as gql;
use std::path::PathBuf;
use std::{fmt::Display, sync::Arc};
use tower_http::trace::TraceLayer;
use tracing_util::{
    add_event_on_active_span, set_status_on_current_span, ErrorVisibility, SpanVisibility,
    TraceableError, TraceableHttpResponse,
};

#[derive(Parser)]
struct ServerOptions {
    #[arg(long, value_name = "METADATA_FILE", env = "METADATA_PATH")]
    metadata_path: PathBuf,
    #[arg(long, value_name = "OTLP_ENDPOINT", env = "OTLP_ENDPOINT")]
    otlp_endpoint: Option<String>,
    #[arg(long, value_name = "AUTHN_CONFIG_FILE", env = "AUTHN_CONFIG_PATH")]
    authn_config_path: PathBuf,
    #[arg(long, value_name = "SERVER_PORT", env = "PORT")]
    port: Option<i32>,
}

struct EngineState {
    http_client: reqwest::Client,
    schema: gql::schema::Schema<GDS>,
    auth_config: AuthConfig,
}

#[tokio::main]
async fn main() {
    let server = ServerOptions::parse();

    let tracer = tracing_util::start_tracer(
        server.otlp_endpoint.clone(),
        "graphql-engine",
        env!("CARGO_PKG_VERSION").to_string(),
    )
    .unwrap();

    if let Err(e) = tracer
        .in_span_async("app init", SpanVisibility::Internal, || {
            Box::pin(start_engine(&server))
        })
        .await
    {
        println!("Error while starting up the engine: {e}");
    }

    tracing_util::shutdown_tracer();
}

#[derive(thiserror::Error, Debug)]
enum StartupError {
    #[error("could not read the auth config - {0}")]
    ReadAuth(String),
    #[error("could not read the schema - {0}")]
    ReadSchema(String),
}

impl TraceableError for StartupError {
    fn visibility(&self) -> tracing_util::ErrorVisibility {
        ErrorVisibility::User
    }
}

async fn start_engine(server: &ServerOptions) -> Result<(), StartupError> {
    let auth_config =
        read_auth_config(&server.authn_config_path).map_err(StartupError::ReadAuth)?;
    let schema = read_schema(&server.metadata_path).map_err(StartupError::ReadSchema)?;
    let state = Arc::new(EngineState {
        http_client: reqwest::Client::new(),
        schema,
        auth_config,
    });

    let graphql_route = Router::new()
        .route("/graphql", post(handle_request))
        .layer(axum::middleware::from_fn(
            hasura_authn_core::resolve_session,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            authentication_middleware,
        ))
        .layer(axum::middleware::from_fn(
            graphql_request_tracing_middleware,
        ))
        // *PLEASE DO NOT ADD ANY MIDDLEWARE
        // BEFORE THE `graphql_request_tracing_middleware`*
        // Refer to it for more details.
        .layer(TraceLayer::new_for_http())
        .with_state(state.clone());

    let app = Router::new()
        // serve graphiql at root
        .route("/", get(graphiql))
        .merge(graphql_route);

    let addr = format!("0.0.0.0:{}", server.port.unwrap_or(3000));

    let log = format!("starting server on {addr}");
    println!("{log}");
    add_event_on_active_span(log);

    // run it with hyper on `addr`
    axum::Server::bind(&addr.as_str().parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();

    Ok(())
}

/// Middleware to start tracing of the `/graphql` request.
/// This middleware must be active for the entire duration
/// of the request i.e. this middleware should be the
/// entry point and the exit point of the GraphQL request.
async fn graphql_request_tracing_middleware<B: Send>(
    request: Request<B>,
    next: Next<B>,
) -> axum::response::Result<axum::response::Response> {
    let tracer = tracing_util::global_tracer();
    let path = "/graphql";

    Ok(tracer
        .in_span_async(path, SpanVisibility::User, || {
            Box::pin(async move {
                let response = next.run(request).await;
                TraceableHttpResponse::new(response, path)
            })
        })
        .await
        .response)
}

#[derive(Debug, thiserror::Error)]
enum AuthError {
    #[error("JWT auth error: {0}")]
    Jwt(#[from] jwt::Error),
    #[error("Webhook auth error: {0}")]
    Webhook(#[from] webhook::Error),
}

impl TraceableError for AuthError {
    fn visibility(&self) -> tracing_util::ErrorVisibility {
        match self {
            AuthError::Jwt(e) => e.visibility(),
            AuthError::Webhook(e) => e.visibility(),
        }
    }
}

impl IntoResponse for AuthError {
    fn into_response(self) -> axum::response::Response {
        match self {
            AuthError::Jwt(e) => e.into_response(),
            AuthError::Webhook(e) => e.into_response(),
        }
    }
}

/// This middleware authenticates the incoming GraphQL request according to the
/// authentication configuration present in the `auth_config` of `EngineState`. The
/// result of the authentication is `hasura-authn-core::Identity`, which is then
/// made available to the GraphQL request handler.
async fn authentication_middleware<'a, B>(
    State(engine_state): State<Arc<EngineState>>,
    headers_map: HeaderMap,
    mut request: Request<B>,
    next: Next<B>,
) -> axum::response::Result<axum::response::Response>
where
    B: HttpBody,
    B::Error: Display,
{
    let tracer = tracing_util::global_tracer();

    let resolved_identity = tracer
        .in_span_async(
            "authentication_middleware",
            SpanVisibility::Internal,
            || {
                Box::pin(async {
                    match &engine_state.auth_config {
                        V1AuthConfig(auth_config) => match &auth_config.mode {
                            AuthModeConfig::Webhook(webhook_config) => {
                                webhook::authenticate_request(
                                    &engine_state.http_client,
                                    webhook_config,
                                    &headers_map,
                                    auth_config.allow_role_emulation_by.clone(),
                                )
                                .await
                                .map_err(AuthError::from)
                            }
                            AuthModeConfig::Jwt(jwt_secret_config) => {
                                jwt_auth::authenticate_request(
                                    &engine_state.http_client,
                                    *jwt_secret_config.clone(),
                                    auth_config.allow_role_emulation_by.clone(),
                                    &headers_map,
                                )
                                .await
                                .map_err(AuthError::from)
                            }
                        },
                    }
                })
            },
        )
        .await?;

    request.extensions_mut().insert(resolved_identity);
    Ok(next.run(request).await)
}

async fn graphiql() -> Html<&'static str> {
    Html(include_str!("index.html"))
}

async fn handle_request(
    State(state): State<Arc<EngineState>>,
    Extension(session): Extension<Session>,
    Json(request): Json<gql::http::RawRequest>,
) -> gql::http::Response {
    let tracer = tracing_util::global_tracer();
    let response = tracer
        .in_span_async("handle_request", SpanVisibility::User, || {
            Box::pin(engine::execute::execute_query(
                &state.http_client,
                &state.schema,
                &session,
                request,
            ))
        })
        .await;

    // Set the span as error if the response contains an error
    // NOTE: Ideally, we should mark the root span as error in `graphql_request_tracing_middleware` function,
    // the tracing middleware, where the span is initialized. It is possible by completing the implementation
    // of `Traceable` trait for `AxumResponse` struct. The said struct just wraps the `axum::response::Response`.
    // The only way to determine the error is to inspect the status code from the `Response` struct.
    // In `/graphql` API, all responses are sent with `200` OK including errors, which leaves no way to deduce errors in the tracing middleware.
    set_status_on_current_span(&response);
    response.0
}

fn read_schema(metadata_path: &PathBuf) -> Result<gql::schema::Schema<GDS>, String> {
    let metadata = std::fs::read_to_string(metadata_path).map_err(|e| e.to_string())?;
    engine::build::build_schema(&metadata).map_err(|e| e.to_string())
}

fn read_auth_config(path: &PathBuf) -> Result<AuthConfig, String> {
    let raw_auth_config = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw_auth_config).map_err(|e| e.to_string())
}
