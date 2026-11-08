# News cover assets

`chatgpt-images-2-6/part-*.b64` contains the ordered base64 source of the animated cover. The source is split into deterministic text fragments; it is not a different image format or a recompressed image.

`npm run build` reconstructs `public/news/chatgpt-images-2-6.gif` before Vite copies static assets. `npm run news:assets` also reconstructs it for local development. The script uses only Node built-ins, requires no network or credentials, and fails before writing if a fragment is missing or the resulting size or SHA256 differs.

- Output: 1,989,275 bytes, GIF89a.
- SHA256: `951d3a2e33e026aa97eba0e933da653fe9642bb46d40227e958e0e60c75b35ee`.
- Public path: `/news/chatgpt-images-2-6.gif`.
- Validation: `npm run test:news-assets`; also included in `npm run test:all`.

The generated GIF is ignored by Git. The committed fragments and checksum are the reproducible source of truth.
