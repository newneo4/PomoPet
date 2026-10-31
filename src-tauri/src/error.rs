//! Application error types for IPC commands.

use serde::{Deserialize, Serialize};

/// Error codes defined in `docs/IPC_CONTRACT.md`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    InvalidArgument,
    NotFound,
    PackInvalid,
    PackTooLarge,
    SignatureInvalid,
    Network,
    Io,
    Internal,
}

/// Standard error response returned by all IPC commands.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, thiserror::Error)]
#[serde(rename_all = "camelCase")]
#[error("{message_key}: {code:?}")]
pub struct AppError {
    pub code: ErrorCode,
    pub message_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl AppError {
    pub fn new(code: ErrorCode, message_key: impl Into<String>, details: Option<String>) -> Self {
        Self {
            code,
            message_key: message_key.into(),
            details,
        }
    }

    pub fn invalid_argument(message_key: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidArgument, message_key, None)
    }

    pub fn not_found(message_key: impl Into<String>) -> Self {
        Self::new(ErrorCode::NotFound, message_key, None)
    }

    pub fn io(message_key: impl Into<String>, details: impl Into<String>) -> Self {
        Self::new(ErrorCode::Io, message_key, Some(details.into()))
    }

    pub fn internal(message_key: impl Into<String>, details: impl Into<String>) -> Self {
        Self::new(ErrorCode::Internal, message_key, Some(details.into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_error_serializes_to_camel_case_contract() {
        let err = AppError::new(
            ErrorCode::InvalidArgument,
            "errors.unauthorized",
            Some("overlay window forbidden".to_string()),
        );
        let val = serde_json::to_value(&err).unwrap();
        assert_eq!(val["code"], "invalid_argument");
        assert_eq!(val["messageKey"], "errors.unauthorized");
        assert_eq!(val["details"], "overlay window forbidden");
    }

    #[test]
    fn app_error_omits_none_details() {
        let err = AppError::invalid_argument("errors.bad_arg");
        let val = serde_json::to_value(&err).unwrap();
        assert!(val.get("details").is_none());
    }
}
