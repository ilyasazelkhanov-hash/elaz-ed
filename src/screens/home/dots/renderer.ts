import * as T from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { CompanionPreferences } from '../../../lib/home-companion'
import { clamp, DOTS_DPR_LIMIT, DOTS_FPS, dotsPose, easePose, safeMood } from './rig'

export type DotsSceneState = { look: CompanionPreferences; mood: string; motion: boolean; active: boolean; reaction: number; lantern?: boolean; gaze: { x: number; y: number } }
export type DotsScene = { update(state: DotsSceneState): void; dispose(): void }
const colors = { violet: '#9d81e7', mint: '#76c7af', peach: '#f4ad8c', sky: '#86bce8' }

/** One small lazy-loaded studio, no downloads, postprocessing, physics worker or perpetual hidden RAF. */
export function createDotsScene(canvas: HTMLCanvasElement, initial: DotsSceneState, failed: () => void): DotsScene {
  let disposed = false
  const cleanups: Array<() => void> = []
  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const cleanup of cleanups.reverse()) { try { cleanup() } catch { /* Continue releasing independent resources. */ } }
  }
  const fail = () => { dispose(); failed() }
  try {
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  cleanups.push(() => { renderer.dispose(); renderer.forceContextLoss() })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DOTS_DPR_LIMIT))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25
  const scene = new T.Scene(), camera = new T.OrthographicCamera(-1.65, 1.65, 1.65, -1.65, .1, 20)
  camera.position.set(0, .55, 6); camera.lookAt(0, .05, 0)
  const environment = new RoomEnvironment()
  cleanups.push(() => environment.dispose())
  const pmrem = new T.PMREMGenerator(renderer)
  cleanups.push(() => pmrem.dispose())
  const env = pmrem.fromScene(environment, .06, .1, 20); scene.environment = env.texture
  cleanups.push(() => env.dispose())
  environment.dispose(); pmrem.dispose()
  scene.add(new T.AmbientLight('#ddd4ff', .45))
  const key = new T.DirectionalLight('#fff7ee', 3.2); key.position.set(-3, 4, 5); scene.add(key)
  const rim = new T.DirectionalLight('#c2d8ff', 2.3); rim.position.set(3, 2, -3); scene.add(rim)
  const fill = new T.DirectionalLight('#f0c6e7', .65); fill.position.set(1, -2, 4); scene.add(fill)
  const materials = new Set<T.Material>(), geometries = new Set<T.BufferGeometry>()
  cleanups.push(() => { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()) })
  const material = <M extends T.Material>(m: M) => { materials.add(m); return m }
  const geo = <G extends T.BufferGeometry>(g: G) => { geometries.add(g); return g }
  const satin = material(new T.MeshPhysicalMaterial({ color: colors[initial.look.color], roughness: .39, metalness: .04, clearcoat: .8, clearcoatRoughness: .27, sheen: .35, sheenColor: new T.Color('#eee5ff'), sheenRoughness: .65, envMapIntensity: .65 }))
  const dark = material(new T.MeshPhysicalMaterial({ color: '#231a34', roughness: .13, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.1 }))
  const ink = material(new T.MeshStandardMaterial({ color: '#36223f', roughness: .5 }))
  const white = material(new T.MeshBasicMaterial({ color: '#fff9ef' }))
  const cheekMat = material(new T.MeshStandardMaterial({ color: '#ee9cc1', roughness: .6, transparent: true, opacity: .55 }))
  const warm = material(new T.MeshPhysicalMaterial({ color: '#f7d9ab', roughness: .4, clearcoat: .5 }))
  const leafMat = material(new T.MeshStandardMaterial({ color: '#639b72', roughness: .5 }))
  const sphere = geo(new T.SphereGeometry(1, 24, 16))
  const bodyGeo = geo(new T.SphereGeometry(1, 48, 32)), original = new Float32Array(bodyGeo.attributes.position.array)
  const rig = new T.Group(), torso = new T.Group(), face = new T.Group(); scene.add(rig); rig.add(torso); torso.add(face)
  const body = new T.Mesh(bodyGeo, satin); torso.add(body)
  function ellipsoid(parent: T.Object3D, mat: T.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const mesh = new T.Mesh(sphere, mat); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh
  }
  // A sculpted soft super-ellipsoid rather than a perfect shiny ball.
  function sculpt(shape: CompanionPreferences['shape']) {
    const p = bodyGeo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = original[i * 3], y = original[i * 3 + 1], z = original[i * 3 + 2]
      const a = Math.atan2(x, y), lobe = shape === 'spark' ? 1 + .16 * Math.cos(a * 5) * Math.hypot(x, y) : 1
      const power = shape === 'round' ? 1 : .83
      const soft = (n: number) => Math.sign(n) * Math.pow(Math.abs(n), power)
      p.setXYZ(i, soft(x) * .75 * lobe * (shape === 'soft' ? 1 - .08 * y : 1), soft(y) * (shape === 'round' ? .79 : .85) * lobe + (shape === 'soft' ? .11 * x * Math.max(y, 0) ** 2 : 0), soft(z) * .57)
    }
    p.needsUpdate = true; bodyGeo.computeVertexNormals()
  }
  const leftArm = new T.Group(), rightArm = new T.Group(); torso.add(leftArm, rightArm)
  leftArm.position.set(-.72, -.12, 0); rightArm.position.set(.72, -.12, 0)
  ellipsoid(leftArm, satin, -.12, -.12, .06, .18, .28, .19).rotation.z = -.3
  ellipsoid(rightArm, satin, .12, -.12, .06, .18, .28, .19).rotation.z = .3
  ellipsoid(torso, satin, -.35, -.76, .06, .26, .15, .3)
  ellipsoid(torso, satin, .35, -.76, .06, .26, .15, .3)
  const eyes: T.Group[] = [], brows: T.Mesh[] = []
  for (const side of [-1, 1]) {
    const eye = new T.Group(); eye.position.set(side * .255, .19, .53); face.add(eye); eyes.push(eye)
    ellipsoid(eye, dark, 0, 0, .04, .125, .18, .105)
    ellipsoid(eye, white, -.032, .062, .13, .033, .045, .017)
    ellipsoid(eye, white, .034, -.035, .135, .014, .018, .008)
    const brow = ellipsoid(face, ink, side * .26, .44, .58, .095, .016, .02); brow.rotation.z = side * -.12; brows.push(brow)
    ellipsoid(face, cheekMat, side * .46, -.08, .5, .1, .048, .025)
  }
  const smileCurve = new T.CatmullRomCurve3([new T.Vector3(-.1, -.12, .6), new T.Vector3(0, -.175, .63), new T.Vector3(.1, -.12, .6)])
  const smile = new T.Mesh(geo(new T.TubeGeometry(smileCurve, 14, .023, 6, false)), ink); face.add(smile)
  const mouth = ellipsoid(face, ink, 0, -.15, .61, .095, .065, .023)
  const tongue = ellipsoid(face, cheekMat, 0, -.19, .639, .058, .025, .01)
  const props = new T.Group(); torso.add(props)
  const glasses = new T.Group(); props.add(glasses)
  const ringGeo = geo(new T.TorusGeometry(.18, .025, 8, 32))
  for (const side of [-1, 1]) { const ring = new T.Mesh(ringGeo, ink); ring.position.set(side * .255, .18, .69); glasses.add(ring) }
  ellipsoid(glasses, ink, 0, .2, .69, .1, .024, .025)
  const headphones = new T.Group(); props.add(headphones)
  const band = new T.Mesh(geo(new T.TorusGeometry(.83, .055, 8, 40, Math.PI)), ink); band.position.set(0, .03, 0); headphones.add(band)
  for (const side of [-1, 1]) { ellipsoid(headphones, warm, side * .79, .01, .02, .13, .26, .25); ellipsoid(headphones, ink, side * .88, .01, .02, .035, .18, .18) }
  const sprout = new T.Group(); sprout.position.set(0, .81, -.03); props.add(sprout)
  ellipsoid(sprout, leafMat, 0, .13, 0, .025, .15, .025)
  const leaf1 = ellipsoid(sprout, leafMat, -.11, .23, 0, .14, .065, .035); leaf1.rotation.z = -.5
  const leaf2 = ellipsoid(sprout, leafMat, .11, .27, 0, .15, .067, .035); leaf2.rotation.z = .5
  // A purely visual lamp held by the right paw. No device/camera/torch access.
  const lantern = new T.Group(); rightArm.add(lantern); lantern.position.set(.08, -.36, .22)
  ellipsoid(lantern, warm, 0, 0, 0, .13, .15, .1)
  const bulb = material(new T.MeshBasicMaterial({ color: '#ffe6a5' }))
  ellipsoid(lantern, bulb, 0, .005, .09, .09, .1, .027)
  ellipsoid(lantern, ink, 0, .16, 0, .085, .025, .05)
  ellipsoid(lantern, ink, 0, -.15, 0, .12, .025, .08)
  const halo = new T.Mesh(geo(new T.CircleGeometry(.31, 24)), material(new T.MeshBasicMaterial({ color: '#ffd694', transparent: true, opacity: .13, depthWrite: false })))
  halo.position.set(0, 0, -.03); lantern.add(halo)
  // Tiny shoulder pin is part of the character, not a particle effect.
  const pin = new T.Mesh(geo(new T.OctahedronGeometry(.075)), warm); pin.position.set(.6, -.4, .42); pin.rotation.z = .2; torso.add(pin)
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = 64; shadowCanvas.height = 64
  const ctx = shadowCanvas.getContext('2d')
  if (ctx) { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31); g.addColorStop(0, 'rgba(64,35,94,.25)'); g.addColorStop(1, 'rgba(64,35,94,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64) }
  const shadowTexture = new T.CanvasTexture(shadowCanvas)
  cleanups.push(() => shadowTexture.dispose())
  const shadow = new T.Mesh(geo(new T.PlaneGeometry(2.35, .55)), material(new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })))
  shadow.position.set(0, -.96, -.15); shadow.rotation.x = -.38; scene.add(shadow)

  let state = initial, frame = 0, last = 0, elapsed = 0, reactionStart = -10, reactionId = initial.reaction
  let previousLook = ''
  const setLook = () => {
    const identity = `${state.look.color}:${state.look.shape}:${state.look.accessory}`
    if (previousLook === identity) return
    previousLook = identity; satin.color.set(colors[state.look.color]); sculpt(state.look.shape)
    glasses.visible = state.look.accessory === 'glasses'; headphones.visible = state.look.accessory === 'headphones'; sprout.visible = state.look.accessory === 'sprout'
  }
  function draw(dt: number) {
    if (disposed) return
    setLook()
    lantern.visible = state.lantern === true
    const pose = dotsPose(elapsed, safeMood(state.mood), elapsed - reactionStart, state.gaze, state.motion)
    rig.rotation.y = easePose(rig.rotation.y, pose.yaw, dt, 7); rig.rotation.x = easePose(rig.rotation.x, pose.pitch, dt, 7); rig.rotation.z = easePose(rig.rotation.z, pose.roll, dt, 7)
    torso.position.y = pose.lift; torso.scale.set(1 + pose.squash, 1 - pose.squash, 1 + pose.squash * .4)
    face.position.x = easePose(face.position.x, pose.gazeX, dt, 20); face.position.y = easePose(face.position.y, pose.gazeY, dt, 20)
    eyes[0].scale.y = pose.leftEye; eyes[1].scale.y = pose.rightEye
    brows[0].position.y = .44 + pose.brow; brows[1].position.y = .44 + (state.mood === 'curious' ? -.025 : pose.brow)
    leftArm.rotation.z = pose.leftArm; rightArm.rotation.z = pose.rightArm
    mouth.visible = state.mood === 'happy' || state.mood === 'curious' || state.mood === 'surprised'; smile.visible = !mouth.visible; tongue.visible = state.mood === 'happy'
    mouth.scale.y = pose.mouth; mouth.scale.x = state.mood === 'curious' || state.mood === 'surprised' ? .055 : .095
    shadow.scale.x = 1 - pose.lift * .2
    renderer.render(scene, camera)
  }
  function stop() { if (frame) cancelAnimationFrame(frame); frame = 0; last = 0 }
  function tick(now: number) {
    frame = 0
    if (disposed || !state.active || !state.motion) return
    if (!last || now - last >= 1000 / DOTS_FPS) {
      const dt = last ? clamp((now - last) / 1000, 0, .08) : 1 / DOTS_FPS
      elapsed += dt; last = now
      try { draw(dt) } catch { fail(); return }
    }
    frame = requestAnimationFrame(tick)
  }
  function schedule() {
    if (disposed) return
    stop()
    if (state.active) { draw(1); if (state.motion) frame = requestAnimationFrame(tick) }
  }
  const resize = () => {
    if (disposed) return
    try {
    const rect = canvas.getBoundingClientRect(), w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height))
    renderer.setSize(w, h, false)
    const aspect = w / h, halfHeight = Math.max(1.32, 1.18 / aspect)
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect
    camera.top = halfHeight + .06; camera.bottom = -halfHeight + .06; camera.updateProjectionMatrix()
    if (state.active) draw(1)
    } catch { fail() }
  }
  const observer = new ResizeObserver(resize)
  cleanups.push(() => { stop(); observer.disconnect() })
  observer.observe(canvas)
  const lost = (event: Event) => { event.preventDefault(); fail() }
  canvas.addEventListener('webglcontextlost', lost, false)
  cleanups.push(() => canvas.removeEventListener('webglcontextlost', lost))
  resize(); if (disposed) throw new Error('Dots renderer unavailable')
  schedule()
  return {
    update(next) { if (disposed) return; state = next; if (reactionId !== next.reaction) { reactionId = next.reaction; reactionStart = elapsed }; try { schedule() } catch { fail() } },
    dispose,
  }
  } catch (error) { dispose(); throw error }
}
