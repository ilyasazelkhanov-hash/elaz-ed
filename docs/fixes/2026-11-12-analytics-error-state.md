# Admin analytics: recoverable request errors

Base: `438d62c`.

Confirmed in `src/screens/Analytics.tsx`: a rejected `adminAnalytics()` request only triggered a toast and left `data === null`, so loading placeholders remained indefinitely. The new backend fail-closed payment report makes a persistent failure state especially important.

Implemented:
- Persistent inline error with `role="alert"`, actual API error text and a reminder that unavailable metrics do not mean zero activity or payments.
- Explicit retry button. Retry clears the error and starts a fresh request; placeholders are announced as a loading status and do not display invented metrics.
- Successful empty responses retain the existing empty collection explanations and genuinely measured zero values.
- Late rejected requests after effect cleanup no longer alter state or invoke the auth guard. Active failures still invoke the existing guard.

Regression coverage in `tests/discovery-analytics.test.mjs` executes the actual screen with controlled API promises: initial loading, HTTP failure, retry, successful empty report and rejection after unmount. Existing discovery report tests cover missing cohorts vs measured zero and empty report collections.

Scope: frontend source and tests only. No database migration, backend deployment or production changes. Browser/device visual QA is not claimed.
