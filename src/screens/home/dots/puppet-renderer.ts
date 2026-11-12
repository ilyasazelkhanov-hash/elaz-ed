import type { CompanionPreferences } from '../../../lib/home-companion'
import type { PuppetPose } from './puppet-motion'

export const PUPPET_ASSETS = { fur: '/companion/puppet-fur-v2.webp', props: '/companion/puppet-props-v2.webp' } as const
export type PuppetImages = { fur: CanvasImageSource; props: CanvasImageSource }
type Rect = { x: number; y: number; w: number; h: number }
type Point = { x: number; y: number }
// Crops include the soft furry edge. All are parts, never animation frames.
export const PUPPET_CROPS = {
  soft: { x: 55, y: 48, w: 397, h: 455 }, round: { x: 534, y: 48, w: 468, h: 456 }, spark: { x: 1073, y: 0, w: 410, h: 507 },
  arm: { x: 154, y: 612, w: 202, h: 341 }, foot: { x: 610, y: 682, w: 315, h: 183 },
  glasses: { x: 24, y: 182, w: 470, h: 183 }, headphones: { x: 514, y: 14, w: 500, h: 478 },
  sprout: { x: 1072, y: 108, w: 434, h: 348 }, lantern: { x: 116, y: 535, w: 272, h: 480 },
  eye: { x: 660, y: 637, w: 206, h: 264 },
} as const
export const PUPPET_LAYOUT = {
  soft: { width: 62, top: 24, height: 78, eyeY: 52, eyeGap: 10, crown: 24, shoulder: 25 },
  round: { width: 70, top: 26, height: 76, eyeY: 53, eyeGap: 11, crown: 26, shoulder: 28 },
  spark: { width: 62, top: 17, height: 85, eyeY: 53, eyeGap: 10, crown: 25, shoulder: 25 },
} as const
const smooth = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v) }
/** Skinning of the torso: a grounded belly and independently turning head, not whole-image scaling. */
export function skinPoint(x: number, y: number, pose: PuppetPose, out: Point): Point {
  const weight = smooth((90 - y) / 31), a = pose.headRotation * weight
  const dx = x - 50, dy = y - 52, c = Math.cos(a), s = Math.sin(a)
  out.x = 50 + dx * c - dy * s + pose.headX * weight
  out.y = 52 + dx * s + dy * c + pose.headY * weight
  return out
}
/** A soft elbow bends the distal paw; its root stays buried in the torso. */
export function skinArm(x: number, y: number, angle: number, origin: Point, out: Point): Point {
  const bend = -Math.sign(angle) * Math.max(0, Math.abs(angle) - .32) * 1.25
  const weight = smooth((y - 7) / 18), b = bend * weight
  const dx = x, dy = y - 8, bx = dx * Math.cos(b) - dy * Math.sin(b), by = 8 + dx * Math.sin(b) + dy * Math.cos(b)
  const c = Math.cos(-angle), si = Math.sin(-angle)
  out.x = origin.x + bx * c - by * si; out.y = origin.y + bx * si + by * c
  return out
}
function sprite(ctx: CanvasRenderingContext2D, image: CanvasImageSource, crop: Rect, x: number, y: number, w: number, h: number) {
  ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, x, y, w, h)
}
function root(ctx: CanvasRenderingContext2D, pose: PuppetPose) {
  ctx.translate(50 + pose.bodyX, 104 + pose.bodyY); ctx.rotate(pose.bodyRotation); ctx.scale(pose.bodyScaleX, pose.bodyScaleY); ctx.translate(-50, -104)
}
function head(ctx: CanvasRenderingContext2D, pose: PuppetPose) {
  ctx.translate(50 + pose.headX, 52 + pose.headY); ctx.rotate(pose.headRotation); ctx.translate(-50, -52)
}
function accessory(ctx: CanvasRenderingContext2D, pose: PuppetPose, y: number) {
  head(ctx, pose); ctx.translate(50, y); ctx.rotate(pose.accessoryRotation * .4); ctx.translate(-50, -y)
}
function eye(ctx: CanvasRenderingContext2D, props: CanvasImageSource, x: number, y: number, openness: number, pose: PuppetPose) {
  // The upper lid travels across a fixed-size eye. It is not a vertically squashed eye sprite.
  const w = 5.1, h = 6.7, top = y - h / 2 + (1 - openness) * h * .94
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - w / 2 - .5, top)
  ctx.quadraticCurveTo(x, top - .8 * openness, x + w / 2 + .5, top)
  ctx.lineTo(x + w / 2 + .5, y + h / 2 + 1); ctx.lineTo(x - w / 2 - .5, y + h / 2 + 1); ctx.closePath(); ctx.clip()
  sprite(ctx, props, PUPPET_CROPS.eye, x - w / 2 + pose.gazeX * .8, y - h / 2 + pose.gazeY * .45, w, h); ctx.restore()
  if (openness < .38) { ctx.strokeStyle = '#35253d'; ctx.lineWidth = .6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 2.25, top); ctx.quadraticCurveTo(x, top + .7, x + 2.25, top); ctx.stroke() }
}
export type PuppetPainter = { paint(pose: PuppetPose, look: CompanionPreferences, lantern?: boolean): void; dispose(): void; triangles: number }
/** Native Canvas2D, 168 skinned triangles. No WebGL, third-party runtime, sensor or animation loop. */
export function createPuppetPainter(ctx: CanvasRenderingContext2D, images: PuppetImages, size: number, furTint?: CanvasImageSource): PuppetPainter {
  const cols = 6, rows = 8, points: Point[] = [], sources: Point[] = [], armPoints: Point[] = [], armSources: Point[] = [], joint: Point = { x: 0, y: 0 }, hand: Point = { x: 0, y: 0 }
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) { points.push({ x: 0, y: 0 }); sources.push({ x: x / cols, y: y / rows }) }
  for (let y = 0; y <= 6; y++) for (let x = 0; x <= 3; x++) { armPoints.push({ x: 0, y: 0 }); armSources.push({ x: x / 3, y: y / 6 }) }
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
    triangles: cols * rows * 2 + 2 * 3 * 6 * 2,
    paint(pose, look, lantern = false) {
      if (!alive) return
      const layout = PUPPET_LAYOUT[look.shape] ?? PUPPET_LAYOUT.soft, crop = PUPPET_CROPS[look.shape] ?? PUPPET_CROPS.soft
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, size, Math.round(size * 1.2)); ctx.setTransform(size / 108, 0, 0, size / 108, size * 4 / 108, size * 4 / 108)
      const shadow = ctx.createRadialGradient(50, 110, 1, 50, 110, 24)
      shadow.addColorStop(0, '#38204922'); shadow.addColorStop(1, '#38204900')
      ctx.save(); ctx.translate(0, 94); ctx.scale(1, .145); ctx.fillStyle = shadow; ctx.fillRect(20, 86, 60, 50); ctx.restore()
      ctx.save(); root(ctx, pose)
      // Feet and shoulders underlap the torso so joints disappear into fur, not glued-on balls.
      sprite(ctx, fur, PUPPET_CROPS.foot, 29, 98 + pose.footLeft, 24, 14)
      sprite(ctx, fur, PUPPET_CROPS.foot, 49, 98 + pose.footRight, 24, 14)
      for (const side of [-1, 1]) {
        skinPoint(50 + side * layout.shoulder, 64, pose, joint)
        const angle = side < 0 ? pose.armLeft : pose.armRight
        for (let i = 0; i < armPoints.length; i++) skinArm(-7.6 + armSources[i].x * 15.2, -6.5 + armSources[i].y * 34, angle, joint, armPoints[i])
        for (let y = 0; y < 6; y++) for (let x = 0; x < 3; x++) { const a = y * 4 + x, b = a + 1, c = a + 4, d = c + 1; triangle(a, b, d, PUPPET_CROPS.arm, armPoints, armSources); triangle(a, d, c, PUPPET_CROPS.arm, armPoints, armSources) }
      }
      const hpX = 50 - layout.width * .57, hpY = layout.crown - 4, hpW = layout.width * 1.14, hpH = 51
      if (look.accessory === 'headphones') { ctx.save(); accessory(ctx, pose, layout.eyeY); sprite(ctx, images.props, PUPPET_CROPS.headphones, hpX, hpY, hpW, hpH); ctx.restore() }
      for (let i = 0; i < points.length; i++) skinPoint(50 - layout.width / 2 + sources[i].x * layout.width, layout.top + sources[i].y * layout.height, pose, points[i])
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const a = y * (cols + 1) + x, b = a + 1, c = a + cols + 1, d = c + 1; triangle(a, b, d, crop); triangle(a, d, c, crop) }
      ctx.save(); head(ctx, pose)
      eye(ctx, images.props, 50 - layout.eyeGap, layout.eyeY, pose.eyeLeft, pose)
      eye(ctx, images.props, 50 + layout.eyeGap, layout.eyeY, pose.eyeRight, pose)
      const mouthY = layout.eyeY + 8, smile = pose.smile
      ctx.lineWidth = .85; ctx.lineCap = 'round'; ctx.strokeStyle = '#4a2d43'; ctx.fillStyle = '#442735'; ctx.beginPath()
      ctx.moveTo(46.5, mouthY); ctx.quadraticCurveTo(50, mouthY + (smile > .65 ? .5 : 3.2) * smile, 53.5, mouthY)
      if (pose.open > .05 || smile > .65) { ctx.quadraticCurveTo(50, mouthY + 5 * smile + pose.open * 6, 46.5, mouthY); ctx.fill() } else ctx.stroke()
      ctx.restore()
      if (look.accessory === 'headphones') {
        ctx.save(); accessory(ctx, pose, layout.eyeY)
        // Rear arch is behind the fur; the ear cushions occlude its front edge on both sides.
        ctx.beginPath(); ctx.rect(hpX, hpY + hpH * .47, hpW * .25, hpH * .53); ctx.rect(hpX + hpW * .75, hpY + hpH * .47, hpW * .25, hpH * .53); ctx.clip()
        sprite(ctx, images.props, PUPPET_CROPS.headphones, hpX, hpY, hpW, hpH); ctx.restore()
      } else if (look.accessory === 'glasses') {
        ctx.save(); accessory(ctx, pose, layout.eyeY); sprite(ctx, images.props, PUPPET_CROPS.glasses, 50 - layout.eyeGap * 1.96, layout.eyeY - 7.5, layout.eyeGap * 3.92, 15.2); ctx.restore()
      } else if (look.accessory === 'sprout') {
        ctx.save(); accessory(ctx, pose, layout.crown); ctx.translate(50, layout.crown + 1); ctx.rotate(pose.accessoryRotation); sprite(ctx, images.props, PUPPET_CROPS.sprout, -9, -14, 18, 15); ctx.restore()
      }
      if (lantern) {
        skinPoint(50 + layout.shoulder, 64, pose, joint); skinArm(0, 23, pose.armRight, joint, hand)
        ctx.save(); ctx.translate(hand.x - 4, hand.y); ctx.rotate(pose.accessoryRotation * .3)
        const glow = ctx.createRadialGradient(0, 10, 1, 0, 10, 16); glow.addColorStop(0, '#ffe6a755'); glow.addColorStop(1, '#ffe6a700'); ctx.fillStyle = glow; ctx.fillRect(-16, -6, 32, 32)
        sprite(ctx, images.props, PUPPET_CROPS.lantern, -5.5, 0, 11, 19.5); ctx.restore()
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
