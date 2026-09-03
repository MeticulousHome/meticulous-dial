use chrono::{DateTime, Datelike, Local, TimeZone, Timelike};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTimeSample {
    year: i32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
    second: u32,
    millisecond: u32,
}

impl LocalTimeSample {
    fn from_datetime<Tz: TimeZone>(now: DateTime<Tz>) -> Self {
        Self {
            year: now.year(),
            month: now.month(),
            day: now.day(),
            hour: now.hour(),
            minute: now.minute(),
            second: now.second(),
            millisecond: now.nanosecond() / 1_000_000,
        }
    }
}

pub fn current() -> LocalTimeSample {
    LocalTimeSample::from_datetime(Local::now())
}

#[cfg(test)]
mod tests {
    use super::*;

    // A fresh process selects each timezone without mutating the environment
    // of Rust's parallel test runner. Chrono reads the host's actual tzdata.
    #[cfg(unix)]
    #[test]
    fn timezone_and_dst_scenarios() {
        for zone in ["Europe/London", "Europe/Zurich", "America/Mexico_City"] {
            let result = std::process::Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "local_time::tests::timezone_child",
                    "--nocapture",
                ])
                .env("TZ", zone)
                .env("DIAL_CLOCK_TEST_ZONE", zone)
                .output()
                .unwrap();
            assert!(
                result.status.success(),
                "{zone}: {}",
                String::from_utf8_lossy(&result.stdout)
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn timezone_child() {
        let Ok(zone) = std::env::var("DIAL_CLOCK_TEST_ZONE") else {
            return;
        };
        let cases = [
            (
                "2026-01-17T12:34:56.500Z",
                [(12, 34, 56, 500), (13, 34, 56, 500), (6, 34, 56, 500)],
            ),
            (
                "2026-08-17T12:34:56.500Z",
                [(13, 34, 56, 500), (14, 34, 56, 500), (6, 34, 56, 500)],
            ),
            (
                "2026-03-29T00:59:59.999Z",
                [(0, 59, 59, 999), (1, 59, 59, 999), (18, 59, 59, 999)],
            ),
            (
                "2026-03-29T01:00:00Z",
                [(2, 0, 0, 0), (3, 0, 0, 0), (19, 0, 0, 0)],
            ),
            (
                "2026-10-25T00:59:59.999Z",
                [(1, 59, 59, 999), (2, 59, 59, 999), (18, 59, 59, 999)],
            ),
            (
                "2026-10-25T01:00:00Z",
                [(1, 0, 0, 0), (2, 0, 0, 0), (19, 0, 0, 0)],
            ),
            (
                "2026-08-17T22:00:00Z",
                [(23, 0, 0, 0), (0, 0, 0, 0), (16, 0, 0, 0)],
            ),
            (
                "2026-08-17T23:00:00Z",
                [(0, 0, 0, 0), (1, 0, 0, 0), (17, 0, 0, 0)],
            ),
            (
                "2026-08-17T05:59:59.999Z",
                [(6, 59, 59, 999), (7, 59, 59, 999), (23, 59, 59, 999)],
            ),
            (
                "2026-08-17T06:00:00Z",
                [(7, 0, 0, 0), (8, 0, 0, 0), (0, 0, 0, 0)],
            ),
        ];
        let column = match zone.as_str() {
            "Europe/London" => 0,
            "Europe/Zurich" => 1,
            "America/Mexico_City" => 2,
            _ => panic!("Unexpected test timezone"),
        };
        for (utc, expected) in cases {
            let now = DateTime::parse_from_rfc3339(utc)
                .unwrap()
                .with_timezone(&Local);
            let sample = LocalTimeSample::from_datetime(now);
            assert_eq!(
                (sample.year, sample.month, sample.day),
                (now.year(), now.month(), now.day())
            );
            assert_eq!(
                (
                    sample.hour,
                    sample.minute,
                    sample.second,
                    sample.millisecond
                ),
                expected[column],
                "{zone} at {utc}"
            );
        }
    }

    #[test]
    fn converts_midnight_without_a_date_offset() {
        let sample = LocalTimeSample::from_datetime(
            DateTime::parse_from_rfc3339("2027-01-01T00:00:00Z").unwrap(),
        );
        assert_eq!((sample.year, sample.month, sample.day), (2027, 1, 1));
        assert_eq!((sample.hour, sample.minute, sample.second), (0, 0, 0));
        assert_eq!(sample.millisecond, 0);
    }

    #[test]
    fn preserves_subsecond_time_at_the_end_of_the_day() {
        let sample = LocalTimeSample::from_datetime(
            DateTime::parse_from_rfc3339("2026-12-31T23:59:59.999999999Z").unwrap(),
        );
        assert_eq!((sample.year, sample.month, sample.day), (2026, 12, 31));
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
