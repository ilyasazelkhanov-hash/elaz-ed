# GIF covers

## Supported path

The editor stores a public HTTPS cover URL; it does not upload or re-encode the image. JPEG, PNG, WebP and now GIF are accepted by `npm run news:publish`. Manual admin URL saves retain existing HTTPS-only validation; they do not run the CLI decoder or enforce its size limits. Use a preverified file when editing manually. Existing `lessons.cover_url` storage is unchanged; no database migration or bucket policy change is required.

For GIF use a direct `.gif` URL (case-insensitive, signed query strings are preserved), or a CDN URL with `format=gif` / `fm=gif`. The publishing preflight checks that this original, persisted URL agrees with the response MIME and real GIF bytes, including after redirects. An opaque URL without this marker is rejected for a GIF, so the client and Telegram never silently choose the wrong media type.

GIF validation preserves the 2 MiB network/stream limit and SSRF protections (public HTTPS, pinned DNS, bounded redirects and timeout). It fully parses GIF87a/GIF89a blocks and LZW image data. Bounds: maximum 4096 pixels per axis, 8,388,608 canvas pixels, 100,000,000 canvas pixels across frames, 300 frames and 60 seconds per cycle. Malformed/truncated streams, invalid palettes/codes and out-of-bounds frames fail closed. Small valid GIFs are allowed; other formats keep their existing minimum size.

## Reading and editing

Home/news cards, article and lesson covers and the editor preview use the original animated file. Each GIF has an accessible pause/play button. Reduced-motion users initially see a still canvas frame and can choose to play. The canvas captures a frame without exporting pixels, so cross-origin image URLs do not need CORS permission. Its internal resolution is capped at 1600 pixels on the long edge. Failed GIFs have a neutral fallback. Cover-open and pause controls are separate buttons.

## Telegram and delivery

The worker uses `sendAnimation` for GIF, `sendPhoto` for existing still formats, preserving captions and the mini-app article link. Only a definite Telegram 400 rejection permits one text fallback. Network errors, malformed responses, server errors or success without message_id are uncertain and stop the queue; they must be reconciled before retry. Refresh uses `editMessageMedia` with type `animation` for a GIF and never creates a new message.

## Rollout

1. Run `npm run test:news`, `npm run test:all`, and review UI checks.
2. Publish the reviewed commit to main; verify the exact Vercel deployment.
3. Deploy only `news-publisher` from the same commit. Vercel does not deploy Supabase Edge Functions. No migration, bulk `db push`, queue reset, or automatic reannouncement is needed.
4. To change an existing post, reconcile its publication receipt and edit the existing message. Do not insert a new published article into the live queue without suppressing a duplicate for an already-existing Telegram announcement.
