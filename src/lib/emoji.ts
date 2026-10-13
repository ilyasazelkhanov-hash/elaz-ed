/** Единые эмодзи Noto: статичный SVG, анимированный WebP и PNG для рисования на canvas. */
export const NOTO = 'https://fonts.gstatic.com/s/e/notoemoji/latest'

/** Код эмодзи в адресе: кодовые точки через подчёркивание. У части эмодзи селектор fe0f в адресе не нужен. */
export function emojiCode(char: string, keepSelector: boolean) {
  return [...char]
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((c) => keepSelector || c !== 'fe0f')
    .join('_')
}
