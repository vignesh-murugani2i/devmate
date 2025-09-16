use base64;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use std::sync::Mutex;
use tauri::State;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn format_text(text: String, format_type: String, state: State<AppState>) -> Result<String, String> {
    // If text is empty, try to get raw content from storage
    let content_to_format = if text.is_empty() {
        let storage = state.lock().map_err(|e| e.to_string())?;
        storage.raw_content.clone().unwrap_or_default()
    } else {
        text
    };
    
    let result = match format_type.as_str() {
        "json" => format_json(&content_to_format),
        "xml" => format_xml(&content_to_format),
        "jwt" => parse_jwt(&content_to_format),
        "json-summary" => summarize_json(&content_to_format),
        "encode" => encode_base64(&content_to_format),
        "decode" => decode_base64(&content_to_format),
        _ => Err("Unknown format type".to_string()),
    };
    
    // Store formatted content in backend for chunked loading
    if let Ok(ref formatted) = result {
        if format_type != "encode" && format_type != "decode" {
            let mut storage = state.lock().map_err(|e| e.to_string())?;
            storage.formatted_content = Some(formatted.clone());
        }
    }
    
    result
}


fn format_json(text: &str) -> Result<String, String> {
    // match serde_json::from_str::<serde_json::Value>(text) {
    //     Ok(parsed) => {
    //         match serde_json::to_string_pretty(&parsed) {
    //             Ok(formatted) => Ok(formatted),
    //             Err(e) => Err(format!("Failed to format JSON: {}", e)),
    //         }
    //     }
    //     Err(e) => Err(format!("Invalid JSON: {}", e)),
    // }
    match serde_json::from_str::<serde_json::Value>(text) {
        Ok(parsed) => serde_json::to_string_pretty(&parsed)
            .map_err(|e| format!("Failed to format JSON: {}", e)),
        Err(e) => {
            // Get line and column from serde_json::Error
            let line = e.line();
            let column = e.column();

            let lines: Vec<&str> = text.lines().collect();
            let error_line = lines.get(line.saturating_sub(1)).unwrap_or(&"");

            let mut marker = String::new();
            for _ in 0..column {
                marker.push('-');
            }
            marker.push('^');

            Err(format!(
                "Parse error on line {} column {}:\n{}\n{}\n{}",
                line,
                column + 1,
                error_line,
                marker,
                e
            ))
        }
    }
}

fn format_xml(text: &str) -> Result<String, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("Empty XML input".to_string());
    }

    // Basic XML validation
    if !trimmed.starts_with('<') || !trimmed.ends_with('>') {
        return Err("Invalid XML: Must start with '<' and end with '>'".to_string());
    }

    // Simple XML formatting with proper depth handling
    let mut formatted = String::new();
    let mut depth: i32 = 0;
    let mut i = 0;
    let chars: Vec<char> = trimmed.chars().collect();
    let mut last_was_text = false; // Track if the last content added was text

    while i < chars.len() {
        if chars[i] == '<' {
            // Find the end of the tag
            let mut tag_end = i;
            while tag_end < chars.len() && chars[tag_end] != '>' {
                tag_end += 1;
            }

            if tag_end >= chars.len() {
                return Err("Invalid XML: Unclosed tag found".to_string());
            }

            // Extract tag content
            let tag_content: String = chars[i + 1..tag_end].iter().collect();
            let is_closing_tag = tag_content.starts_with('/');
            let is_self_closing = tag_content.ends_with('/');

            if is_closing_tag {
                // Always decrease depth for closing tags first
                depth -= 1;

                // Only add newline and indentation if the last content was NOT text
                if !last_was_text {
                    formatted.push('\n');
                    formatted.push_str(&"  ".repeat(depth.max(0) as usize));
                }
                // Reset the text flag
                last_was_text = false;
            } else {
                // Opening tag or self-closing tag - add newline and indentation
                if !formatted.is_empty() {
                    formatted.push('\n');
                }

                formatted.push_str(&"  ".repeat(depth.max(0) as usize));

                // Only increase depth for non-self-closing opening tags
                if !is_self_closing {
                    depth += 1;
                }

                // Reset the text flag for new tags
                last_was_text = false;
            }

            // Add the complete tag
            for j in i..=tag_end {
                formatted.push(chars[j]);
            }

            i = tag_end + 1;
        } else if !chars[i].is_whitespace() {
            // Handle text content - collect until next tag
            let text_start = i;

            while i < chars.len() && chars[i] != '<' {
                i += 1;
            }

            // Add the text content (trimmed)
            let text_content: String = chars[text_start..i]
                .iter()
                .collect::<String>()
                .trim()
                .to_string();
            if !text_content.is_empty() {
                formatted.push_str(&text_content);
                last_was_text = true; // Mark that we just added text content
            }
        } else {
            // Skip whitespace between tags
            i += 1;
        }
    }

    // Final validation: depth should be 0 if XML is properly balanced
    if depth != 0 {
        return Err("Invalid XML: Unbalanced tags detected".to_string());
    }

    Ok(formatted)
}

fn parse_jwt(token: &str) -> Result<String, String> {
    let token = token.trim();

    if token.is_empty() {
        return Err("Empty JWT token".to_string());
    }

    // Split JWT token into parts
    let parts: Vec<&str> = token.split('.').collect();

    if parts.len() != 3 {
        return Err("Invalid JWT format. Expected 3 parts separated by dots.".to_string());
    }

    let mut result = serde_json::Map::new();

    // Decode header
    match decode_jwt_part(parts[0]) {
        Ok(header) => {
            result.insert("header".to_string(), header);
        }
        Err(e) => return Err(format!("Failed to decode JWT header: {}", e)),
    }

    // Decode payload
    match decode_jwt_part(parts[1]) {
        Ok(payload) => {
            result.insert("payload".to_string(), payload);
        }
        Err(e) => return Err(format!("Failed to decode JWT payload: {}", e)),
    }

    // Add signature info (we can't decode it without the secret)
    result.insert(
        "signature".to_string(),
        serde_json::Value::String(format!("Signature (base64): {}", parts[2])),
    );

    // Add token parts for reference
    let mut token_parts = serde_json::Map::new();
    token_parts.insert(
        "header".to_string(),
        serde_json::Value::String(parts[0].to_string()),
    );
    token_parts.insert(
        "payload".to_string(),
        serde_json::Value::String(parts[1].to_string()),
    );
    token_parts.insert(
        "signature".to_string(),
        serde_json::Value::String(parts[2].to_string()),
    );
    result.insert(
        "token_parts".to_string(),
        serde_json::Value::Object(token_parts),
    );

    // Convert to pretty JSON
    match serde_json::to_string_pretty(&result) {
        Ok(formatted) => Ok(formatted),
        Err(e) => Err(format!("Failed to format JWT output: {}", e)),
    }
}

fn decode_jwt_part(encoded: &str) -> Result<serde_json::Value, String> {
    // Add padding if needed (JWT base64 encoding omits padding)
    let mut padded = encoded.to_string();
    while padded.len() % 4 != 0 {
        padded.push('=');
    }

    // Replace URL-safe characters
    let standard_base64 = padded.replace('-', "+").replace('_', "/");

    // Decode base64
    match STANDARD.decode(&standard_base64) {
        Ok(decoded_bytes) => {
            // Convert to string
            match String::from_utf8(decoded_bytes) {
                Ok(decoded_string) => {
                    // Parse as JSON
                    match serde_json::from_str(&decoded_string) {
                        Ok(json_value) => Ok(json_value),
                        Err(e) => Err(format!("Invalid JSON in JWT part: {}", e)),
                    }
                }
                Err(e) => Err(format!("Invalid UTF-8 in JWT part: {}", e)),
            }
        }
        Err(e) => Err(format!("Invalid base64 encoding: {}", e)),
    }
}

fn encode_base64(text: &str) -> Result<String, String> {
    if text.is_empty() {
        return Ok(String::new()); // Return empty string instead of error
    }
    Ok(STANDARD.encode(text.as_bytes()))
}

fn decode_base64(text: &str) -> Result<String, String> {
    let text = text.trim();
    if text.is_empty() {
        return Ok(String::new()); // Return empty string instead of error
    }
    match STANDARD.decode(text) {
        Ok(decoded_bytes) => match String::from_utf8(decoded_bytes) {
            Ok(decoded_string) => Ok(decoded_string),
            Err(e) => Err(format!("Invalid UTF-8 in decoded data: {}", e)),
        },
        Err(e) => Err(format!("Invalid base64 encoding: {}", e)),
    }
}

fn summarize_json(text: &str) -> Result<String, String> {
    let trimmed = text.trim();

    if trimmed.is_empty() {
        return Err("Empty JSON input".to_string());
    }

    // Parse the JSON to validate it
    let parsed_value: serde_json::Value = match serde_json::from_str(trimmed) {
        Ok(value) => value,
        Err(e) => return Err(format!("Invalid JSON: {}", e)),
    };

    // Generate summary
    let summary = generate_json_summary(&parsed_value, "root", 0);

    // Format as a readable summary
    let mut result = String::new();
    result.push_str("JSON Structure Summary:\n");
    result.push_str("======================\n\n");
    result.push_str(&summary);

    // Add statistics
    let stats = calculate_json_stats(&parsed_value);
    result.push_str("\n\nStatistics:\n");
    result.push_str("-----------\n");
    result.push_str(&format!("Total objects: {}\n", stats.objects));
    result.push_str(&format!("Total arrays: {}\n", stats.arrays));
    result.push_str(&format!("Total primitive values: {}\n", stats.primitives));
    result.push_str(&format!("Maximum depth: {}\n", stats.max_depth));
    result.push_str(&format!("Total keys: {}\n", stats.total_keys));

    Ok(result)
}

fn generate_json_summary(value: &serde_json::Value, key: &str, depth: usize) -> String {
    let indent = "  ".repeat(depth);

    match value {
        serde_json::Value::Object(obj) => {
            let mut summary = String::new();
            if depth == 0 {
                summary.push_str(&format!(
                    "{}📁 {} (Object with {} keys)\n",
                    indent,
                    key,
                    obj.len()
                ));
            } else {
                summary.push_str(&format!(
                    "{}📁 {}: Object ({} keys)\n",
                    indent,
                    key,
                    obj.len()
                ));
            }

            for (k, v) in obj.iter() {
                summary.push_str(&generate_json_summary(v, k, depth + 1));
            }
            summary
        }
        serde_json::Value::Array(arr) => {
            let mut summary = String::new();
            summary.push_str(&format!(
                "{}📋 {}: Array ({} items)\n",
                indent,
                key,
                arr.len()
            ));

            if !arr.is_empty() {
                // Show type of first element and if all elements are the same type
                let first_type = get_value_type(&arr[0]);
                let all_same_type = arr.iter().all(|v| get_value_type(v) == first_type);

                if all_same_type {
                    summary.push_str(&format!("{}   └─ All items are: {}\n", indent, first_type));
                } else {
                    summary.push_str(&format!("{}   └─ Mixed types: ", indent));
                    let mut types = std::collections::HashSet::new();
                    for item in arr.iter() {
                        types.insert(get_value_type(item));
                    }
                    let type_list: Vec<String> = types.into_iter().collect();
                    summary.push_str(&type_list.join(", "));
                    summary.push('\n');
                }

                // If it's an array of objects, show the structure of the first object
                if let serde_json::Value::Object(_) = &arr[0] {
                    summary.push_str(&format!("{}   └─ First item structure:\n", indent));
                    summary.push_str(&generate_json_summary(&arr[0], "item", depth + 2));
                }
            }
            summary
        }
        serde_json::Value::String(s) => {
            let preview = if s.len() > 50 {
                format!("{}...", &s[..47])
            } else {
                s.clone()
            };
            format!(
                "{}📝 {}: String ({} chars) - \"{}\"\n",
                indent,
                key,
                s.len(),
                preview
            )
        }
        serde_json::Value::Number(n) => {
            format!("{}🔢 {}: Number - {}\n", indent, key, n)
        }
        serde_json::Value::Bool(b) => {
            format!("{}✅ {}: Boolean - {}\n", indent, key, b)
        }
        serde_json::Value::Null => {
            format!("{}❌ {}: null\n", indent, key)
        }
    }
}

fn get_value_type(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Object(_) => "Object".to_string(),
        serde_json::Value::Array(_) => "Array".to_string(),
        serde_json::Value::String(_) => "String".to_string(),
        serde_json::Value::Number(_) => "Number".to_string(),
        serde_json::Value::Bool(_) => "Boolean".to_string(),
        serde_json::Value::Null => "null".to_string(),
    }
}

struct JsonStats {
    objects: usize,
    arrays: usize,
    primitives: usize,
    max_depth: usize,
    total_keys: usize,
}

fn calculate_json_stats(value: &serde_json::Value) -> JsonStats {
    let mut stats = JsonStats {
        objects: 0,
        arrays: 0,
        primitives: 0,
        max_depth: 0,
        total_keys: 0,
    };

    calculate_stats_recursive(value, &mut stats, 0);
    stats
}

fn calculate_stats_recursive(value: &serde_json::Value, stats: &mut JsonStats, depth: usize) {
    stats.max_depth = stats.max_depth.max(depth);

    match value {
        serde_json::Value::Object(obj) => {
            stats.objects += 1;
            stats.total_keys += obj.len();
            for v in obj.values() {
                calculate_stats_recursive(v, stats, depth + 1);
            }
        }
        serde_json::Value::Array(arr) => {
            stats.arrays += 1;
            for v in arr.iter() {
                calculate_stats_recursive(v, stats, depth + 1);
            }
        }
        _ => {
            stats.primitives += 1;
        }
    }
}

// Content storage for managing large files
#[derive(Default)]
struct ContentStorage {
    raw_content: Option<String>,
    formatted_content: Option<String>,
}

pub type AppState = Mutex<ContentStorage>;

#[tauri::command]
fn store_raw_content(content: String, state: State<AppState>) -> Result<(), String> {
    let mut storage = state.lock().map_err(|e| e.to_string())?;
    storage.raw_content = Some(content);
    storage.formatted_content = None; // Clear formatted content when new raw content is set
    Ok(())
}

#[tauri::command]
fn get_content_chunk(
    content_type: String, // "raw" or "formatted"
    start: usize,
    chunk_size: usize,
    state: State<AppState>
) -> Result<serde_json::Value, String> {
    let storage = state.lock().map_err(|e| e.to_string())?;
    
    let content = match content_type.as_str() {
        "raw" => storage.raw_content.as_ref(),
        "formatted" => storage.formatted_content.as_ref(),
        _ => return Err("Invalid content type".to_string()),
    };
    
    match content {
        Some(content_str) => {
            let total_length = content_str.len();
            let end = std::cmp::min(start + chunk_size, total_length);
            
            if start >= total_length {
                return Ok(serde_json::json!({
                    "chunk": "",
                    "has_more": false,
                    "total_length": total_length,
                    "next_start": total_length
                }));
            }
            
            let chunk = &content_str[start..end];
            let has_more = end < total_length;
            
            Ok(serde_json::json!({
                "chunk": chunk,
                "has_more": has_more,
                "total_length": total_length,
                "next_start": end
            }))
        },
        None => Err("No content stored".to_string()),
    }
}

#[tauri::command]
fn get_content_info(state: State<AppState>) -> Result<serde_json::Value, String> {
    let storage = state.lock().map_err(|e| e.to_string())?;
    
    let raw_length = storage.raw_content.as_ref().map(|s| s.len()).unwrap_or(0);
    let formatted_length = storage.formatted_content.as_ref().map(|s| s.len()).unwrap_or(0);
    
    Ok(serde_json::json!({
        "has_raw": storage.raw_content.is_some(),
        "has_formatted": storage.formatted_content.is_some(),
        "raw_length": raw_length,
        "formatted_length": formatted_length
    }))
}

#[tauri::command]
fn clear_content(state: State<AppState>) -> Result<(), String> {
    let mut storage = state.lock().map_err(|e| e.to_string())?;
    storage.raw_content = None;
    storage.formatted_content = None;
    Ok(())
}

#[tauri::command]
fn read_large_file_streaming(file_path: String, state: State<AppState>) -> Result<serde_json::Value, String> {
    use std::fs::File;
    use std::io::{BufReader, Read};
    
    let file = File::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;
    let metadata = file.metadata().map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let file_size = metadata.len();
    
    // For files larger than 100MB, we'll read them in streaming mode
    if file_size > 100 * 1024 * 1024 {
        // Read file in chunks and store in backend
        let mut reader = BufReader::new(file);
        let mut content = String::new();
        
        // Read the entire file (we have enough memory in Rust backend)
        reader.read_to_string(&mut content).map_err(|e| format!("Failed to read file: {}", e))?;
        
        // Store in backend
        let mut storage = state.lock().map_err(|e| e.to_string())?;
        storage.raw_content = Some(content);
        storage.formatted_content = None;
        
        Ok(serde_json::json!({
            "success": true,
            "file_size": file_size,
            "use_streaming": true,
            "message": "Large file loaded successfully using streaming mode"
        }))
    } else {
        // For smaller files, let frontend handle normally
        Ok(serde_json::json!({
            "success": true,
            "file_size": file_size,
            "use_streaming": false,
            "message": "File size is manageable, frontend can handle normally"
        }))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            format_text,
            store_raw_content,
            get_content_chunk,
            get_content_info,
            clear_content,
            read_large_file_streaming
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
