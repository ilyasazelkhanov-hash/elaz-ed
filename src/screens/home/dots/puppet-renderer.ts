import type { CompanionPreferences } from '../../../lib/home-companion'
import type { PuppetPose } from './puppet-motion'

export const PUPPET_ASSETS = { fur: '/companion/abstract-plush-v6.webp', props: '/companion/puppet-props-v2.webp' } as const
// Four extra units above the model keep a sprout inside the canvas during extreme gaze.
export const PUPPET_VIEWBOX = { minX: -4, minY: -8, maxX: 104, maxY: 121.6, width: 108 } as const
export type PuppetImages = { fur: CanvasImageSource; props: CanvasImageSource }
type Rect = { x: number; y: number; w: number; h: number }
type Point = { x: number; y: number }
// Crops include the soft furry edge. All are parts, never animation frames.
export const PUPPET_CROPS = {
  soft: { x: 38, y: 132, w: 439, h: 342 }, round: { x: 565, y: 99, w: 401, h: 387 }, spark: { x: 1078, y: 54, w: 410, h: 427 },
  glasses: { x: 24, y: 182, w: 470, h: 183 }, headphones: { x: 514, y: 14, w: 500, h: 478 },
  sprout: { x: 1072, y: 108, w: 434, h: 348 }, eye: { x: 660, y: 637, w: 206, h: 264 },
} as const
export const PUPPET_LAYOUT = {
  soft: { width: 90, top: 26, height: 70, faceX: 52, eyeY: 58, eyeGap: 9.5, crown: 26, crownX: 50, wearWidth: 68 },
  round: { width: 80, top: 20, height: 77, faceX: 50.5, eyeY: 54, eyeGap: 10.5, crown: 20, crownX: 57, wearWidth: 80 },
  spark: { width: 81, top: 10, height: 86, faceX: 48, eyeY: 58, eyeGap: 10, crown: 12, crownX: 74, wearWidth: 68 },
} as const
const smooth = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v) }
/** A continuous soft volume: surface flow is strongest near the edge, not a whole-sticker bob. */
export function skinPoint(x: number, y: number, pose: PuppetPose, out: Point): Point {
  const dx = x - 50, dy = y - 60, nx = dx / 46, ny = dy / 46
  const edge = Math.min(1, nx * nx + ny * ny), upper = smooth((94 - y) / 50)
  const a = pose.headRotation * upper + pose.coreTwist * ny, c = Math.cos(a), si = Math.sin(a)
  const phase = pose.flowPhase, ripple = pose.ripple
  out.x = 50 + dx * c - dy * si + pose.headX * upper + Math.sin(ny * 3.2 + phase) * ripple * (.2 + edge)
  out.y = 60 + dx * si + dy * c + pose.headY * upper + Math.cos(nx * 3.1 - phase * .83) * ripple * edge * .7
  return out
}
/** Face and wearables follow the same deformed surface, using a local tangent frame. */
export function surfaceBasis(x: number, y: number, pose: PuppetPose) {
  const p = skinPoint(x, y, pose, { x: 0, y: 0 }), u = skinPoint(x + 1, y, pose, { x: 0, y: 0 }), v = skinPoint(x, y + 1, pose, { x: 0, y: 0 })
  return { a: u.x - p.x, b: u.y - p.y, c: v.x - p.x, d: v.y - p.y, x: p.x, y: p.y }
}
function sprite(ctx: CanvasRenderingContext2D, image: CanvasImageSource, crop: Rect, x: number, y: number, w: number, h: number) {
  ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, x, y, w, h)
}
function root(ctx: CanvasRenderingContext2D, pose: PuppetPose) {
  ctx.translate(50 + pose.bodyX, 60 + pose.bodyY); ctx.rotate(pose.bodyRotation); ctx.scale(pose.bodyScaleX, pose.bodyScaleY); ctx.translate(-50, -60)
}
function surface(ctx: CanvasRenderingContext2D, pose: PuppetPose, x: number, y: number, lag = 0) {
  const basis = surfaceBasis(x, y, pose)
  ctx.transform(basis.a, basis.b, basis.c, basis.d, basis.x, basis.y)
  ctx.rotate(pose.accessoryRotation * lag); ctx.translate(-x, -y)
}
function eye(ctx: CanvasRenderingContext2D, props: CanvasImageSource, x: number, y: number, openness: number, pose: PuppetPose) {
  // The upper lid travels across a fixed-size eye. It is not a vertically squashed eye sprite.
  const w = 7.6, h = 10, top = y - h / 2 + (1 - openness) * h * .94
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - w / 2 - .5, top)
  ctx.quadraticCurveTo(x, top - .8 * openness, x + w / 2 + .5, top)
  ctx.lineTo(x + w / 2 + .5, y + h / 2 + 1); ctx.lineTo(x - w / 2 - .5, y + h / 2 + 1); ctx.closePath(); ctx.clip()
  sprite(ctx, props, PUPPET_CROPS.eye, x - w / 2 + pose.gazeX * .8, y - h / 2 + pose.gazeY * .45, w, h); ctx.restore()
  if (openness < .38) { ctx.strokeStyle = '#35253d'; ctx.lineWidth = .6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 3.4, top); ctx.quadraticCurveTo(x, top + .7, x + 3.4, top); ctx.stroke() }
}
export type PuppetPainter = { paint(pose: PuppetPose, look: CompanionPreferences, lantern?: boolean): void; dispose(): void; triangles: number }
/** Native Canvas2D, 96 skinned triangles. Limbless artwork in every state. No WebGL, third-party runtime, sensor or animation loop. */
export function createPuppetPainter(ctx: CanvasRenderingContext2D, images: PuppetImages, size: number, furTint?: CanvasImageSource): PuppetPainter {
  const cols = 6, rows = 8, points: Point[] = [], sources: Point[] = []
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) { points.push({ x: 0, y: 0 }); sources.push({ x: x / cols, y: y / rows }) }
  let alive = true
  const fur = furTint ?? images.fur
  function triangle(a: number, b: number, c: number, crop: Rect, target = points, source = sources) {
    const p = target[a], q = target[b], r = target[c], u = source[a], v = source[b], w = source[c]
    const ux = crop.x + u.x * crop.w, uy = crop.y + u.y * crop.h, vx = crop.x + v.x * crop.w, vy = crop.y + v.y * crop.h, wx = crop.x + w.x * crop.w, wy = crop.y + w.y * crop.h
    const den = (vx - ux) * (wy - uy) - (wx - ux) * (vy - uy)
    const aa = ((q.x - p.x) * (wy - uy) - (r.x - p.x) * (vy - uy)) / den
    const bb = ((q.y - p.y) * (wy - uy) - (r.y - p.y) * (vy - uy)) / den
    const cc = ((r.x - p.x) * (vx - ux) - (q.x - p.x) * (wx - ux)) / den
    const dd = ((r.y - p.y) * (vx - ux) - (q.y - p.y) * (wx - ux)) / den
    // Slightly overlap interior raster edges to avoid Canvas antialias seams; atlas padding stays transparent.
    const mx = (p.x + q.x + r.x) / 3, my = (p.y + q.y + r.y) / 3
    ctx.save(); ctx.beginPath(); ctx.moveTo(mx + (p.x - mx) * 1.12, my + (p.y - my) * 1.12)
    ctx.lineTo(mx + (q.x - mx) * 1.12, my + (q.y - my) * 1.12); ctx.lineTo(mx + (r.x - mx) * 1.12, my + (r.y - my) * 1.12); ctx.closePath(); ctx.clip()
    ctx.transform(aa, bb, cc, dd, p.x - aa * ux - cc * uy, p.y - bb * ux - dd * uy)
    ctx.drawImage(fur, crop.x, crop.y, crop.w, crop.h, crop.x, crop.y, crop.w, crop.h); ctx.restore()
  }
  return {
    triangles: cols * rows * 2,
    paint(pose, look, lantern = false) {
      if (!alive) return
      const layout = PUPPET_LAYOUT[look.shape] ?? PUPPET_LAYOUT.soft, crop = PUPPET_CROPS[look.shape] ?? PUPPET_CROPS.soft
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, size, Math.round(size * 1.2)); ctx.setTransform(size / PUPPET_VIEWBOX.width, 0, 0, size / PUPPET_VIEWBOX.width, -size * PUPPET_VIEWBOX.minX / PUPPET_VIEWBOX.width, -size * PUPPET_VIEWBOX.minY / PUPPET_VIEWBOX.width)
      // A soft ambient aura is manual decoration, never the device torch or a held prop.
      if (lantern) {
        const glow = ctx.createRadialGradient(50, 67, 7, 50, 67, 49)
        glow.addColorStop(0, '#ffe8b333'); glow.addColorStop(1, '#ffe8b300'); ctx.fillStyle = glow; ctx.fillRect(0, 5, 100, 114)
      }
      const shadow = ctx.createRadialGradient(50, 110, 1, 50, 110, 25)
      shadow.addColorStop(0, '#38204918'); shadow.addColorStop(1, '#38204900')
      ctx.save(); ctx.translate(0, 94); ctx.scale(1, .13); ctx.fillStyle = shadow; ctx.fillRect(20, 86, 60, 50); ctx.restore()
      ctx.save(); root(ctx, pose)
      const hpW = layout.wearWidth, hpX = layout.faceX - hpW / 2, hpY = layout.crown - 3, hpH = 47
      if (look.accessory === 'headphones') { ctx.save(); surface(ctx, pose, layout.faceX, layout.eyeY, .4); sprite(ctx, images.props, PUPPET_CROPS.headphones, hpX, hpY, hpW, hpH); ctx.restore() }
      for (let i = 0; i < points.length; i++) skinPoint(50 - layout.width / 2 + sources[i].x * layout.width, layout.top + sources[i].y * layout.height, pose, points[i])
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const a = y * (cols + 1) + x, b = a + 1, c = a + cols + 1, d = c + 1; triangle(a, b, d, crop); triangle(a, d, c, crop) }
      ctx.save(); surface(ctx, pose, layout.faceX, layout.eyeY)
      eye(ctx, images.props, layout.faceX - layout.eyeGap, layout.eyeY, pose.eyeLeft, pose)
      eye(ctx, images.props, layout.faceX + layout.eyeGap, layout.eyeY, pose.eyeRight, pose)
      const mouthY = layout.eyeY + 9, smile = pose.smile, mouthX = layout.faceX
      ctx.lineWidth = .85; ctx.lineCap = 'round'; ctx.strokeStyle = '#4a2d43'; ctx.fillStyle = '#442735'; ctx.beginPath()
      ctx.moveTo(mouthX - 3.5, mouthY); ctx.quadraticCurveTo(mouthX, mouthY + (smile > .65 ? .5 : 3.2) * smile, mouthX + 3.5, mouthY)
      if (pose.open > .05 || smile > .65) { ctx.quadraticCurveTo(mouthX, mouthY + 5 * smile + pose.open * 6, mouthX - 3.5, mouthY); ctx.fill() } else ctx.stroke()
      ctx.restore()
      if (look.accessory === 'headphones') {
        ctx.save(); surface(ctx, pose, layout.faceX, layout.eyeY, .4)
        // Rear arch is behind the fur; the ear cushions occlude its front edge on both sides.
        ctx.beginPath(); ctx.rect(hpX, hpY + hpH * .47, hpW * .33, hpH * .53); ctx.rect(hpX + hpW * .67, hpY + hpH * .47, hpW * .33, hpH * .53); ctx.clip()
        sprite(ctx, images.props, PUPPET_CROPS.headphones, hpX, hpY, hpW, hpH); ctx.restore()
      } else if (look.accessory === 'glasses') {
        ctx.save(); surface(ctx, pose, layout.faceX, layout.eyeY, .4); sprite(ctx, images.props, PUPPET_CROPS.glasses, layout.faceX - layout.eyeGap * 1.96, layout.eyeY - 7.5, layout.eyeGap * 3.92, 15.2); ctx.restore()
      } else if (look.accessory === 'sprout') {
        ctx.save(); surface(ctx, pose, layout.crownX, layout.crown, .6); ctx.translate(layout.crownX, layout.crown + 1); ctx.rotate(pose.accessoryRotation); sprite(ctx, images.props, PUPPET_CROPS.sprout, -9, -14, 18, 15); ctx.restore()
      }
      ctx.restore()
    },
    dispose() { alive = false },
  }
}

/** One-time palette baking; works in WebViews lacking CanvasRenderingContext2D.filter. */
export function tintPuppetPixels(data: Uint8ClampedArray, color: CompanionPreferences['color']): void {
  if (color === 'violet') return
  const [degrees, saturation] = ({ mint: [245, .83], peach: [105, 1.2], sky: [305, .9] } as const)[color] ?? [0, 1]
  const c = Math.cos(degrees * Math.PI / 180), s = Math.sin(degrees * Math.PI / 180)
  const m = [.213 + .787*c - .213*s, .715 - .715*c - .715*s, .072 - .072*c + .928*s,
    .213 - .213*c + .143*s, .715 + .285*c + .140*s, .072 - .072*c - .283*s,
    .213 - .213*c - .787*s, .715 - .715*c + .715*s, .072 + .928*c + .072*s]
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i+3]) continue
    const r=data[i],g=data[i+1],b=data[i+2], rr=m[0]*r+m[1]*g+m[2]*b, gg=m[3]*r+m[4]*g+m[5]*b, bb=m[6]*r+m[7]*g+m[8]*b
    const grey=.213*rr+.715*gg+.072*bb
    data[i]=grey+(rr-grey)*saturation;data[i+1]=grey+(gg-grey)*saturation;data[i+2]=grey+(bb-grey)*saturation
  }
}
