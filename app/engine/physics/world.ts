import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat'
import type { BoxSize } from '../box'
import { D6_EDGE_RADIUS, D6_SIZE } from '../dice/d6'
import { distance, length, type Quat, type Vec3 } from '../math'

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
/** Shared by the dice and the walls: Rapier combines the two sides of a contact. */
const RESTITUTION = 0.35
const FRICTION = 0.5

/**
 * Rapier does not wake sleeping bodies when gravity changes, so the dice are
 * woken by hand once gravity has moved this far (in m/s²) from where it was
 * when they were last woken. Sensor noise at rest is about a tenth of this.
 */
const WAKE_ACCELERATION_DELTA = 0.5

const REST_LINEAR_SPEED = 1
const REST_ANGULAR_SPEED = 0.5
const REST_DURATION_S = 0.25

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

  addD6(): void {
    const { RigidBodyDesc, ColliderDesc } = this.rapier
    const half = D6_SIZE / 2
    const body = this.world.createRigidBody(
      RigidBodyDesc.dynamic()
        .setTranslation(0, 0, half)
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
    // The viewport can shrink under the dice (screen rotation), so pull any
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
    // Half extents and centre of each slab. The side walls overlap the floor
    // and the glass so no corner is left open.
    const slabs: [Vec3, Vec3][] = [
      [{ x: hx + 2 * t, y: hy + 2 * t, z: t }, { x: 0, y: 0, z: -t }],
      [{ x: hx + 2 * t, y: hy + 2 * t, z: t }, { x: 0, y: 0, z: depth + t }],
      [{ x: t, y: hy + 2 * t, z: hz + 2 * t }, { x: -hx - t, y: 0, z: hz }],
      [{ x: t, y: hy + 2 * t, z: hz + 2 * t }, { x: hx + t, y: 0, z: hz }],
      [{ x: hx + 2 * t, y: t, z: hz + 2 * t }, { x: 0, y: -hy - t, z: hz }],
      [{ x: hx + 2 * t, y: t, z: hz + 2 * t }, { x: 0, y: hy + t, z: hz }],
    ]
    this.walls = slabs.map(([half, centre]) => this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setTranslation(centre.x, centre.y, centre.z)
        .setRestitution(RESTITUTION)
        .setFriction(FRICTION),
    ))
  }
}

function isSlow(die: RigidBody): boolean {
  return die.isSleeping()
    || (length(die.linvel()) < REST_LINEAR_SPEED && length(die.angvel()) < REST_ANGULAR_SPEED)
}
