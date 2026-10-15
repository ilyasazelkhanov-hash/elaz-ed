// Шрифты из public/fonts (Onest и Unbounded, лицензия OFL — файлы LICENSE рядом).
// Рендер ждёт их загрузки, поэтому первый кадр уже с правильной гарнитурой.
import { continueRender, delayRender, staticFile } from 'remotion';

const CYRILLIC = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';
const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

const faces = [
  ['Onest', 'fonts/onest-cyrillic-wght-normal.woff2', CYRILLIC],
  ['Onest', 'fonts/onest-latin-wght-normal.woff2', LATIN],
  ['Unbounded', 'fonts/unbounded-cyrillic-wght-normal.woff2', CYRILLIC],
  ['Unbounded', 'fonts/unbounded-latin-wght-normal.woff2', LATIN],
] as const;

let started = false;

export const loadFonts = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Шрифты Onest и Unbounded');
  Promise.all(
    faces.map(([family, file, range]) => {
      const face = new FontFace(family, `url(${staticFile(file)}) format('woff2')`, {
        weight: '100 900',
        unicodeRange: range,
      });
      return face.load().then((f) => document.fonts.add(f));
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
};
