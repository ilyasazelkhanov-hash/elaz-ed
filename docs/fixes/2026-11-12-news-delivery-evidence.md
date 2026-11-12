# News delivery evidence

## Confirmed defect

A definite Telegram 400 response to `sendAnimation` or `sendPhoto` may trigger a
single `sendMessage` fallback. Previously the receipt was `sent` with no warning,
so operators could mistake successful text delivery for a GIF.

## Compatible fix

- Keep `status=sent` when Telegram accepts the fallback and returns a message ID.
  Do not retry it or change queue ordering.
- Set existing `error_code=media_400_text_fallback` on that successful receipt.
  This is a degraded-delivery warning, not a delivery failure. Always interpret
  it together with `status`. No schema or RPC signature changes are needed.
- Return `deliveries` in the worker response and emit a bounded structured
  `news_delivery_recorded` log after the receipt is successfully recorded.
  It contains lesson/message IDs, requested media, actual returned media and
  fallback flag. It never includes credentials, source URLs or message bodies.
- Determine `delivered` from returned Telegram Message fields. A message ID or
  the choice of `sendAnimation` alone is not evidence of animation. Missing
  fields mean `unknown`, not success as GIF.
- Timeouts, malformed responses and ambiguous fallback results retain existing
  `uncertain` behavior and block automatic resend.

## Operational interpretation

`sent` proves that a message was accepted; it does not prove visual quality or
that a recipient opened it. `media_400_text_fallback` proves fallback was used.
Logs/response can provide stronger media evidence but have finite retention.
Older receipts without a warning are not retrospectively confirmed as GIF.
The refresh/edit path is unchanged and its existing response does not establish
media identity. Do not infer current message format after later edits from the
initial send evidence.

For a durable searchable record of all media types, a future dedicated receipt
column and atomic RPC migration are preferable to overloading `error_code` with
success metadata. This narrow fix intentionally uses that field only for a real
warning and leaves normal successful receipts unchanged.

## Deployment and verification

This is Edge Function source, not a frontend fix: a GitHub/Vercel deployment
alone does not update the running `news-publisher`. Explicitly deploy the
function through the approved backend path, verify its revision, then inspect
new receipts. Do not resend existing successful posts as a test. No database,
production function, existing receipts or Telegram messages were changed here.

Regression tests cover worker execution and real PGlite RPC behavior: fallback
warning persists on `sent`, retry_at stays null, sent receipts are not reclaimed,
actual media fields are distinguished from unknown, ambiguity never becomes a
successful degraded result.
