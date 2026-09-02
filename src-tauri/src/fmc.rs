use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// This FMC instance presents a certificate that fails normal validation.
// Because these requests run in the Rust backend (not the webview), there's
// no browser CORS enforcement either — both blockers that ruled out a
// plain client-side web app are avoided by construction here.
fn client() -> Client {
    Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .expect("failed to build HTTP client")
}

#[derive(Default)]
pub struct Connection {
    pub host: String,
    pub domain: String,
    pub token: Option<String>,
}

pub struct AppState {
    pub conn: Mutex<Connection>,
}

impl Default for AppState {
    fn default() -> Self {
        AppState {
            conn: Mutex::new(Connection {
                host: String::new(),
                domain: String::new(),
                token: None,
            }),
        }
    }
}

#[derive(Serialize)]
pub struct ConnectionInfo {
    host: String,
    domain: String,
    connected: bool,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct DomainInfo {
    pub uuid: String,
    pub name: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DynamicObject {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub object_type: String,
}

#[derive(Deserialize)]
struct MappingItem {
    mapping: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceRecord {
    pub id: String,
    pub name: String,
    // FMC's own API keeps this one snake_case, unlike the rest of its fields.
    #[serde(default, rename = "license_caps")]
    pub license_caps: Vec<String>,
    #[serde(default)]
    pub access_policy: Option<AccessPolicyRef>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct AccessPolicyRef {
    pub id: String,
    pub name: String,
}

#[derive(Deserialize)]
struct AccessRule {
    name: String,
    #[serde(default, rename = "intrusionPolicy")]
    intrusion_policy: Option<NamedRef>,
}

#[derive(Deserialize)]
struct NamedRef {
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyThreatUsage {
    pub uses_intrusion_policy: bool,
    pub reasons: Vec<String>,
}

// --- low-level request helpers -----------------------------------------

async fn authed_request(
    conn: &Connection,
    method: Method,
    path: &str,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let token = conn.token.as_ref().ok_or("Not connected to FMC — set a token first.")?;
    let url = format!("{}{}", conn.host, path);

    let mut req = client()
        .request(method, &url)
        .header("X-auth-access-token", token)
        .header("Accept", "application/json");

    if let Some(b) = &body {
        req = req.header("Content-Type", "application/json").json(b);
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = if text.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(serde_json::Value::String(text.clone()))
    };

    if !status.is_success() {
        return Err(format!("FMC request failed ({}): {}", status.as_u16(), json));
    }
    Ok(json)
}

async fn api(conn: &Connection, method: Method, path: &str, body: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    if conn.domain.is_empty() {
        return Err("No FMC domain configured — set it first.".to_string());
    }
    authed_request(conn, method, path, body).await
}

async fn paginate(conn: &Connection, base_path: &str) -> Result<Vec<serde_json::Value>, String> {
    let mut items = Vec::new();
    let mut offset = 0u32;
    let limit = 200u32;
    let sep = if base_path.contains('?') { "&" } else { "?" };
    loop {
        let path = format!("{base_path}{sep}limit={limit}&offset={offset}");
        let page = api(conn, Method::GET, &path, None).await?;
        let page_items = page.get("items").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let count = page
            .get("paging")
            .and_then(|p| p.get("count"))
            .and_then(|c| c.as_u64())
            .unwrap_or(items.len() as u64 + page_items.len() as u64);
        let n = page_items.len();
        items.extend(page_items);
        offset += n as u32;
        if n == 0 || (offset as u64) >= count {
            break;
        }
    }
    Ok(items)
}

// --- commands -------------------------------------------------------------

#[tauri::command]
pub fn get_connection(state: State<AppState>) -> ConnectionInfo {
    let conn = state.conn.lock().unwrap();
    ConnectionInfo {
        host: conn.host.clone(),
        domain: conn.domain.clone(),
        connected: conn.token.is_some(),
    }
}

#[tauri::command]
pub fn set_connection(state: State<AppState>, host: Option<String>, domain: Option<String>, token: Option<String>) {
    let mut conn = state.conn.lock().unwrap();
    if let Some(h) = host {
        if !h.trim().is_empty() {
            conn.host = h.trim().trim_end_matches('/').to_string();
        }
    }
    if let Some(d) = domain {
        conn.domain = d.trim().to_string();
    }
    if let Some(t) = token {
        if !t.trim().is_empty() {
            conn.token = Some(t.trim().to_string());
        }
    }
}

#[tauri::command]
pub async fn login(state: State<'_, AppState>, username: String, password: String) -> Result<(), String> {
    let host = { state.conn.lock().unwrap().host.clone() };
    let url = format!("{host}/api/fmc_platform/v1/auth/generatetoken");

    let res = client()
        .post(&url)
        .basic_auth(username, Some(password))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    let token = res
        .headers()
        .get("x-auth-access-token")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    if !status.is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Login failed ({}): {}", status.as_u16(), text));
    }

    let token = token.ok_or("FMC did not return X-auth-access-token in the response headers.")?;
    state.conn.lock().unwrap().token = Some(token);
    Ok(())
}

fn snapshot(state: &State<AppState>) -> Connection {
    let c = state.conn.lock().unwrap();
    Connection {
        host: c.host.clone(),
        domain: c.domain.clone(),
        token: c.token.clone(),
    }
}

#[tauri::command]
pub async fn list_domains(state: State<'_, AppState>) -> Result<Vec<DomainInfo>, String> {
    let conn = snapshot(&state);
    let res = authed_request(&conn, Method::GET, "/api/fmc_platform/v1/info/domain", None).await?;
    let items = res.get("items").cloned().unwrap_or(serde_json::Value::Array(vec![]));
    serde_json::from_value(items).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_dynamic_objects(state: State<'_, AppState>) -> Result<Vec<DynamicObject>, String> {
    let conn = snapshot(&state);
    let path = format!("/api/fmc_config/v1/domain/{}/object/dynamicobjects", conn.domain);
    let items = paginate(&conn, &path).await?;
    items.into_iter().map(|v| serde_json::from_value(v).map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub async fn get_dynamic_object(state: State<'_, AppState>, id: String) -> Result<DynamicObject, String> {
    let conn = snapshot(&state);
    let path = format!("/api/fmc_config/v1/domain/{}/object/dynamicobjects/{}", conn.domain, id);
    let res = api(&conn, Method::GET, &path, None).await?;
    serde_json::from_value(res).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_dynamic_object(
    state: State<'_, AppState>,
    name: String,
    description: String,
    object_type: String,
) -> Result<DynamicObject, String> {
    let conn = snapshot(&state);
    let path = format!("/api/fmc_config/v1/domain/{}/object/dynamicobjects", conn.domain);
    let body = serde_json::json!({
        "name": name,
        "description": description,
        "objectType": object_type,
        "type": "DynamicObject",
    });
    let res = api(&conn, Method::POST, &path, Some(body)).await?;
    serde_json::from_value(res).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_mappings(state: State<'_, AppState>, id: String) -> Result<Vec<String>, String> {
    let conn = snapshot(&state);
    let path = format!("/api/fmc_config/v1/domain/{}/object/dynamicobjects/{}/mappings", conn.domain, id);
    let res = api(&conn, Method::GET, &path, None).await?;
    let items = res.get("items").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let mappings: Vec<MappingItem> = items
        .into_iter()
        .filter_map(|v| serde_json::from_value(v).ok())
        .collect();
    Ok(mappings.into_iter().map(|m| m.mapping).collect())
}

async fn mapping_op(state: &State<'_, AppState>, id: &str, ip: &str, add: bool) -> Result<(), String> {
    let conn = snapshot(state);
    let path = format!("/api/fmc_config/v1/domain/{}/object/dynamicobjectmappings", conn.domain);
    let entry = serde_json::json!({ "dynamicObject": { "id": id }, "mappings": [ip] });
    let body = if add {
        serde_json::json!({ "add": [entry], "remove": [] })
    } else {
        serde_json::json!({ "add": [], "remove": [entry] })
    };
    api(&conn, Method::POST, &path, Some(body)).await?;
    Ok(())
}

#[tauri::command]
pub async fn add_mapping(state: State<'_, AppState>, id: String, ip: String) -> Result<(), String> {
    mapping_op(&state, &id, &ip, true).await
}

#[tauri::command]
pub async fn remove_mapping(state: State<'_, AppState>, id: String, ip: String) -> Result<(), String> {
    mapping_op(&state, &id, &ip, false).await
}

#[tauri::command]
pub async fn list_devices(state: State<'_, AppState>) -> Result<Vec<DeviceRecord>, String> {
    let conn = snapshot(&state);
    let path = format!("/api/fmc_config/v1/domain/{}/devices/devicerecords?expanded=true", conn.domain);
    let items = paginate(&conn, &path).await?;
    items.into_iter().map(|v| serde_json::from_value(v).map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub async fn get_policy_threat_usage(state: State<'_, AppState>, policy_id: String) -> Result<PolicyThreatUsage, String> {
    let conn = snapshot(&state);
    let mut reasons = Vec::new();

    let rules_path = format!(
        "/api/fmc_config/v1/domain/{}/policy/accesspolicies/{}/accessrules?expanded=true",
        conn.domain, policy_id
    );
    let rule_items = paginate(&conn, &rules_path).await?;
    for v in rule_items {
        if let Ok(rule) = serde_json::from_value::<AccessRule>(v) {
            if let Some(ip) = rule.intrusion_policy {
                reasons.push(format!("Rule \"{}\" uses Intrusion Policy \"{}\"", rule.name, ip.name));
            }
        }
    }

    let default_path = format!(
        "/api/fmc_config/v1/domain/{}/policy/accesspolicies/{}/defaultactions?expanded=true",
        conn.domain, policy_id
    );
    if let Ok(res) = api(&conn, Method::GET, &default_path, None).await {
        if let Some(item) = res.get("items").and_then(|v| v.as_array()).and_then(|a| a.first()) {
            if let Some(ip) = item.get("intrusionPolicy").and_then(|v| v.get("name")).and_then(|v| v.as_str()) {
                reasons.push(format!("Default action uses Intrusion Policy \"{ip}\""));
            }
        }
    }

    Ok(PolicyThreatUsage {
        uses_intrusion_policy: !reasons.is_empty(),
        reasons,
    })
}
