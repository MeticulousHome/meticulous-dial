use chrono::{Local, Timelike};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTimeSample {
    hour: u32,
    minute: u32,
    second: u32,
    millisecond: u32,
}

impl LocalTimeSample {
    fn from_components(hour: u32, minute: u32, second: u32, nanosecond: u32) -> Self {
        Self {
            hour,
            minute,
            second,
            millisecond: nanosecond / 1_000_000,
        }
    }
}

pub fn current() -> LocalTimeSample {
    let now = Local::now();
    LocalTimeSample::from_components(
        now.hour(),
        now.minute(),
        now.second(),
        now.nanosecond(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_midnight_without_a_date_offset() {
        let sample = LocalTimeSample::from_components(0, 0, 0, 0);
        assert_eq!((sample.hour, sample.minute, sample.second), (0, 0, 0));
        assert_eq!(sample.millisecond, 0);
    }

    #[test]
    fn preserves_subsecond_time_at_the_end_of_the_day() {
        let sample = LocalTimeSample::from_components(23, 59, 59, 999_999_999);
        assert_eq!((sample.hour, sample.minute, sample.second), (23, 59, 59));
        assert_eq!(sample.millisecond, 999);
    }

    #[test]
    fn os_sample_is_within_one_local_day() {
        let sample = current();
        assert!(sample.hour < 24);
        assert!(sample.minute < 60);
        assert!(sample.second < 60);
        assert!(sample.millisecond < 1_000);
    }
}
