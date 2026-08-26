use napi::{Error, Result, Status};

/// The largest integer that JavaScript can represent exactly as a `number`.
pub(crate) const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// Convert a JavaScript number to a Rust `usize` without accepting values that
/// JavaScript cannot represent exactly.
pub(crate) fn js_safe_usize(field: &'static str, value: f64) -> Result<usize> {
  if !value.is_finite() || value < 0.0 || value.fract() != 0.0 {
    return Err(invalid_arg(format!(
      "{field} must be a non-negative finite integer"
    )));
  }

  if value > MAX_SAFE_INTEGER || value > usize::MAX as f64 {
    return Err(invalid_arg(format!(
      "{field} exceeds the supported safe integer range"
    )));
  }

  Ok(value as usize)
}

/// Convert a Rust `usize` to a JavaScript number only when the conversion is
/// exact and remains within JavaScript's safe-integer range.
pub(crate) fn js_number_from_usize(field: &'static str, value: usize) -> Result<f64> {
  let number = value as f64;

  if number > MAX_SAFE_INTEGER {
    return Err(invalid_arg(format!(
      "{field} exceeds the supported safe integer range"
    )));
  }

  Ok(number)
}

fn invalid_arg(message: String) -> Error {
  Error::new(Status::InvalidArg, message)
}

#[cfg(test)]
mod tests {
  use super::{js_number_from_usize, js_safe_usize, MAX_SAFE_INTEGER};

  #[test]
  fn accepts_zero() {
    assert_eq!(js_safe_usize("count", 0.0).unwrap(), 0);
    assert_eq!(js_number_from_usize("count", 0).unwrap(), 0.0);
  }

  #[test]
  fn accepts_the_maximum_safe_integer_when_usize_can_hold_it() {
    if cfg!(target_pointer_width = "64") {
      assert_eq!(
        js_safe_usize("count", MAX_SAFE_INTEGER).unwrap(),
        MAX_SAFE_INTEGER as usize
      );
      assert_eq!(
        js_number_from_usize("count", MAX_SAFE_INTEGER as usize).unwrap(),
        MAX_SAFE_INTEGER
      );
    } else {
      assert!(js_safe_usize("count", MAX_SAFE_INTEGER).is_err());
    }
  }

  #[test]
  fn rejects_negative_values() {
    assert!(js_safe_usize("count", -1.0).is_err());
  }

  #[test]
  fn rejects_fractional_values() {
    assert!(js_safe_usize("count", 1.5).is_err());
  }

  #[test]
  fn rejects_non_finite_values() {
    assert!(js_safe_usize("count", f64::NAN).is_err());
    assert!(js_safe_usize("count", f64::INFINITY).is_err());
    assert!(js_safe_usize("count", f64::NEG_INFINITY).is_err());
  }

  #[test]
  fn rejects_values_above_the_maximum_safe_integer() {
    assert!(js_safe_usize("count", MAX_SAFE_INTEGER + 1.0).is_err());

    if cfg!(target_pointer_width = "64") {
      assert!(js_number_from_usize("count", (MAX_SAFE_INTEGER as usize) + 1).is_err());
      assert!(js_number_from_usize("count", usize::MAX).is_err());
    } else {
      assert!(js_number_from_usize("count", usize::MAX).is_ok());
    }
  }

  #[test]
  fn includes_the_field_name_in_argument_errors() {
    let error = js_safe_usize("maxLineWidth", -1.0).unwrap_err();

    assert_eq!(error.status, napi::Status::InvalidArg);
    assert!(error.reason.contains("maxLineWidth"));
  }
}
