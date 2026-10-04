import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat'
import type { BoxSize } from '../box'
import { D6_EDGE_RADIUS, D6_SIZE } from '../dice/d6'
import { axisAngle, distance, length, multiply, type Quat, type Vec3 } from '../math'

/** The Rapier module, passed in so that only the caller decides when its WASM is loaded. */
export type Rapier = typeof import('@dimforge/rapier3d-compat').default

/** World units are centimetres, so that a 1.6-unit die is a real 16 mm die. */
const UNITS_PER_METRE = 100

/**
 * Real-size dice under real accelerations cross their own width in a few
 * milliseconds, so the step has to be far shorter than a frame. Measured over
 * 60 hard synthetic shakes, a die sank up to 9 mm into a wall at 120 Hz and
 * 2 mm at 480 Hz; stiffer contacts and more solver iterations barely helped.
 */
const FIXED_DT = 1 / 480
/** Cap on catch-up steps after a slow frame (50 ms worth), so one hitch cannot snowball. */
const MAX_STEPS_PER_FRAME = 24

const WALL_THICKNESS = 4
/**
 * Bounce of the dice, the floor and the glass; Rapier averages the two sides
 * of a contact. At 0.35 a die tipping over an edge slapped flat and stopped
 * within a frame, as if pulled by a magnet; at 0.8 it rocks to a stop.
 */
const RESTITUTION = 0.8
/**
 * Bounce against the side walls, which win a contact with a die (the Min
 * rule). A hard shake hits them far faster than a die ever hits the floor, and
 * at the dice's bounce it sank a die visibly into a wall.
 */
const SIDE_WALL_RESTITUTION = 0.35
/** Tuned with the bounce, so a die rolls on a little before it stops. */
const FRICTION = 0.4

/**
 * Rapier does not wake sleeping bodies when gravity changes, so the dice are
 * woken by hand once gravity has moved this far (in m/s²) from where it was
 * when they were last woken. Sensor noise at rest is about a tenth of this.
 */
const WAKE_ACCELERATION_DELTA = 0.5

/**
 * Width (cm) of the 45° bevel where the glass meets the side walls, like the
 * rounded inside of a real cup. A cube only tips over from a push when
 * friction is at least 1, so a die shaken side to side with the phone screen
 * down slid flat on the glass and hit the walls face on; the bevel catches its
 * leading edge and turns it. The floor has none: a die at rest would lean on
 * it, cocked against a wall that is drawn square.
 */
const BEVEL = 0.6

const REST_LINEAR_SPEED = 1
const REST_ANGULAR_SPEED = 0.5
const REST_DURATION_S = 0.25

const X_AXIS: Vec3 = { x: 1, y: 0, z: 0 }
const Y_AXIS: Vec3 = { x: 0, y: 1, z: 0 }
const Z_AXIS: Vec3 = { x: 0, y: 0, z: 1 }
/** One rotation per face of a cube that leaves that face pointing up (+z). */
const FACE_UP_ROTATIONS: readonly Quat[] = [
  { x: 0, y: 0, z: 0, w: 1 },
  axisAngle(X_AXIS, Math.PI / 2),
  axisAngle(X_AXIS, -Math.PI / 2),
  axisAngle(X_AXIS, Math.PI),
  axisAngle(Y_AXIS, Math.PI / 2),
  axisAngle(Y_AXIS, -Math.PI / 2),
]

export class PhysicsWorld {
  private readonly world: World
  private walls: Collider[] = []
  private readonly dice: RigidBody[] = []
  private accumulator = 0
  private restTime = 0
  private wakeAcceleration: Vec3 | null = null

  constructor(private readonly rapier: Rapier, private box: BoxSize) {
    this.world = new rapier.World({ x: 0, y: 0, z: 0 })
    this.world.timestep = FIXED_DT
    this.buildWalls()
  }

  get dieCount(): number {
    return this.dice.length
  }

  /** Nothing can move until the dice are woken, so there is nothing new to draw. */
  get asleep(): boolean {
    return this.dice.every(die => die.isSleeping())
  }

  get diceAtRest(): boolean {
    return this.restTime >= REST_DURATION_S
  }

  /**
   * Adds a d6 lying flat on the floor. With `random`, it lies at a random
   * place with a random face up and a random turn, as if left from the last
   * roll; without, it lies in the middle with the 3 up, for repeatable tests
   * and debugging.
   */
  addD6(random?: () => number): void {
    const { RigidBodyDesc, ColliderDesc } = this.rapier
    const half = D6_SIZE / 2
    let position: Vec3 = { x: 0, y: 0, z: half }
    let rotation: Quat = FACE_UP_ROTATIONS[0]!
    if (random) {
      // Clear of the walls at any turn, which takes half the diagonal; a box
      // too small for that keeps it in the middle.
      const reach = half * Math.SQRT2
      const rangeX = Math.max(0, this.box.width / 2 - reach)
      const rangeY = Math.max(0, this.box.height / 2 - reach)
      position = { x: (2 * random() - 1) * rangeX, y: (2 * random() - 1) * rangeY, z: half }
      const faceUp = FACE_UP_ROTATIONS[Math.floor(random() * FACE_UP_ROTATIONS.length)]!
      rotation = multiply(axisAngle(Z_AXIS, random() * 2 * Math.PI), faceUp)
    }
    const body = this.world.createRigidBody(
      RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(rotation)
        // A hard shake moves a die further than its own size in one step.
        .setCcdEnabled(true),
    )
    // roundCuboid takes the half extents of the inner box, before rounding.
    const inner = half - D6_EDGE_RADIUS
    this.world.createCollider(
      ColliderDesc.roundCuboid(inner, inner, inner, D6_EDGE_RADIUS)
        .setRestitution(RESTITUTION)
        .setFriction(FRICTION),
      body,
    )
    this.dice.push(body)
  }

  /**
   * Applies an `accelerationIncludingGravity` reading (m/s², W3C convention).
   * Inside the device the dice feel the opposite of what the device feels.
   */
  setAcceleration(acceleration: Vec3): void {
    this.world.gravity = {
      x: -acceleration.x * UNITS_PER_METRE,
      y: -acceleration.y * UNITS_PER_METRE,
      z: -acceleration.z * UNITS_PER_METRE,
    }
    if (!this.wakeAcceleration || distance(acceleration, this.wakeAcceleration) > WAKE_ACCELERATION_DELTA) {
      this.wakeAcceleration = { ...acceleration }
      for (const die of this.dice) die.wakeUp()
    }
  }

  step(dtSeconds: number): void {
    this.accumulator = Math.min(this.accumulator + dtSeconds, MAX_STEPS_PER_FRAME * FIXED_DT)
    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT
      this.world.step()
      this.restTime = this.dice.every(isSlow) ? this.restTime + FIXED_DT : 0
    }
  }

  /**
   * Launches every die up at `lift` and sideways at `push` (cm/s) in a random
   * direction, spinning at `spin` (rad/s) about a random axis, so it tumbles
   * whatever face it starts on.
   */
  launchDice({ lift, push, spin }: { lift: number, push: number, spin: number }, random: () => number): void {
    for (const die of this.dice) {
      const heading = 2 * Math.PI * random()
      die.setLinvel({ x: push * Math.cos(heading), y: push * Math.sin(heading), z: lift }, true)
      const axis = randomDirection(random)
      die.setAngvel({ x: spin * axis.x, y: spin * axis.y, z: spin * axis.z }, true)
    }
  }

  diePosition(index: number): Vec3 {
    return this.dice[index]!.translation()
  }

  dieRotation(index: number): Quat {
    return this.dice[index]!.rotation()
  }

  resize(box: BoxSize): void {
    this.box = box
    for (const wall of this.walls) this.world.removeCollider(wall, false)
    this.buildWalls()
    // The viewport can shrink under the dice (a browser toolbar), so pull any
    // that are now outside back in.
    const half = D6_SIZE / 2
    const limitX = box.width / 2 - half
    const limitY = box.height / 2 - half
    for (const die of this.dice) {
      const p = die.translation()
      const x = Math.max(-limitX, Math.min(limitX, p.x))
      const y = Math.max(-limitY, Math.min(limitY, p.y))
      if (x !== p.x || y !== p.y) die.setTranslation({ x, y, z: p.z }, true)
    }
  }

  dispose(): void {
    this.world.free()
  }

  private buildWalls(): void {
    const { width, height, depth } = this.box
    const t = WALL_THICKNESS / 2
    const hx = width / 2
    const hy = height / 2
    const hz = depth / 2
    // The side walls overlap the floor and the glass so no corner is left open.
    const slabs: Slab[] = [
      { half: { x: hx + 2 * t, y: hy + 2 * t, z: t }, centre: { x: 0, y: 0, z: -t }, side: false },
      { half: { x: hx + 2 * t, y: hy + 2 * t, z: t }, centre: { x: 0, y: 0, z: depth + t }, side: false },
      { half: { x: t, y: hy + 2 * t, z: hz + 2 * t }, centre: { x: -hx - t, y: 0, z: hz }, side: true },
      { half: { x: t, y: hy + 2 * t, z: hz + 2 * t }, centre: { x: hx + t, y: 0, z: hz }, side: true },
      { half: { x: hx + 2 * t, y: t, z: hz + 2 * t }, centre: { x: 0, y: -hy - t, z: hz }, side: true },
      { half: { x: hx + 2 * t, y: t, z: hz + 2 * t }, centre: { x: 0, y: hy + t, z: hz }, side: true },
    ]
    // A square bar turned 45° along each edge of the glass leaves a bevel
    // BEVEL wide on both faces.
    const b = BEVEL / Math.SQRT2
    const alongX = axisAngle(X_AXIS, Math.PI / 4)
    const alongY = axisAngle(Y_AXIS, Math.PI / 4)
    for (const sign of [-1, 1]) {
      slabs.push({ half: { x: hx, y: b, z: b }, centre: { x: 0, y: sign * hy, z: depth }, side: true, rotation: alongX })
      slabs.push({ half: { x: b, y: hy, z: b }, centre: { x: sign * hx, y: 0, z: depth }, side: true, rotation: alongY })
    }
    const { ColliderDesc, CoefficientCombineRule } = this.rapier
    this.walls = slabs.map(({ half, centre, side, rotation }) => {
      const desc = ColliderDesc.cuboid(half.x, half.y, half.z)
        .setTranslation(centre.x, centre.y, centre.z)
        .setFriction(FRICTION)
        .setRestitution(side ? SIDE_WALL_RESTITUTION : RESTITUTION)
      if (rotation) desc.setRotation(rotation)
      if (side) desc.setRestitutionCombineRule(CoefficientCombineRule.Min)
      return this.world.createCollider(desc)
    })
  }
}

/** A fixed box of the cup: half extents and centre, and whether it is a side wall. */
interface Slab {
  half: Vec3
  centre: Vec3
  side: boolean
  rotation?: Quat
}

/** A uniformly random unit vector: z uniform in [-1, 1], longitude uniform. */
function randomDirection(random: () => number): Vec3 {
  const z = 2 * random() - 1
  const longitude = 2 * Math.PI * random()
  const r = Math.sqrt(1 - z * z)
  return { x: r * Math.cos(longitude), y: r * Math.sin(longitude), z }
}

function isSlow(die: RigidBody): boolean {
  return die.isSleeping()
    || (length(die.linvel()) < REST_LINEAR_SPEED && length(die.angvel()) < REST_ANGULAR_SPEED)
}
