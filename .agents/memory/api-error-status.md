---
name: Generated API error status
description: How the generated web API client exposes HTTP status codes for retry and user-facing error handling
---

Generated API client errors expose the HTTP status directly as `error.status` (and include the parsed payload in `error.data`). Do not rely only on `error.response.status` when deciding whether to retry or how to describe an error.

**Why:** Treating `401` as a transient network error caused unnecessary retries and made authentication failures look intermittent. Server/database failures must remain distinguishable from invalid credentials.

**How to apply:** For query and mutation retry policies, read `error.status` first and fall back to `error.response.status` only for compatibility. Show the server's `error.data.error` for non-401 failures.