import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat'
import type { BoxSize } from '../box'
import { D6_EDGE_RADIUS, D6_SIZE } from '../dice/d6'
import { axisAngle, distance, dot, length, multiply, rotate, type Quat, type Vec3 } from '../math'

/** The Rapier module, passed in so that only the caller decides when its WASM is loaded. */
export type Rapier = typeof import('@dimforge/rapier3d-compat').default

/** World units are centimetres, so that a 1.2-unit die is a real 12 mm die. */
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
 * leading edge and turns it. Three eighths of the die's edge, as first tuned.
 */
const BEVEL = D6_SIZE * 3 / 8
/**
 * The same bevel where the floor meets the side walls, for a die shaken side
 * to side screen-up, which slid on the floor and kept its face: 23 times in 30
 * on a recorded iPhone shake without it, 3 with it. It is kept narrow because a die at rest can lean
 * on it, cocked against the wall. For a 12 mm die, over 480
 * replayed rolls: at 1 mm 2 came to rest tilted and a side-to-side shake left
 * 18% on their starting face, as a fair die would; at 1.25 mm 13 were tilted;
 * at 0.75 mm 45% kept their face.
 */
const FLOOR_BEVEL = 0.1

/**
 * A step counts as part of a hit when contacts change a die's velocity by more
 * than this many times what gravity adds in a step, plus IMPACT_MIN_SPEED. A
 * die resting on the floor, or pressed against a wall by a hard shake, is held
 * there by exactly what gravity adds; a hit changes it far more.
 */
const IMPACT_GRAVITY_MULTIPLE = 3
/** In cm/s; see IMPACT_GRAVITY_MULTIPLE. */
const IMPACT_MIN_SPEED = 3
/**
 * A hit pushing the die within about 45° of straight up (or down) came from
 * the floor (or the glass); anything else came from a wall.
 */
const IMPACT_FLOOR_MIN_Z = Math.SQRT1_2
/**
 * A hit pushing a die within about 45° of the line of its contact with
 * another die came from that die; anything else from the cup.
 */
const IMPACT_DIE_MIN_ALIGNMENT = Math.SQRT1_2

/** The most dice the cup holds, for screen space and performance. */
export const MAX_DICE = 12
/** Random places tried for a new die on the floor, before it goes in above the others. */
const PLACE_ATTEMPTS = 100
/** Room (cm) between the dice of the grid a fixed start lays out. */
const START_GAP = 0.4
/** The least room (cm) left between a new die and the others, so it starts clear of them. */
const PLACE_GAP = 0.1

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

/** What a die hit: a part of the cup, or another die. */
export type Surface = 'floor' | 'glass' | 'wall' | 'die'

/** A die hitting the cup, or two dice hitting each other, during one frame. */
export interface Impact {
  /** For two dice, the lower-numbered one. */
  die: number
  /** How much the hit changed the die's velocity, in cm/s. */
  speed: number
  surface: Surface
}

export class PhysicsWorld {
  private readonly world: World
  private walls: Collider[] = []
  private readonly dice: RigidBody[] = []
  /** Each die's index by its body's handle, to tell which die a contact is with. */
  private dieIndex = new Map<number, number>()
  private accumulator = 0
  private restTime = 0
  private wakeAcceleration: Vec3 | null = null
  private _impacts: Impact[] = []

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

  /**
   * The hits during the latest step(): at most one on the cup per die, and
   * one per pair of dice that hit each other, so that a collision is heard once.
   */
  get impacts(): readonly Impact[] {
    return this._impacts
  }

  get diceAtRest(): boolean {
    return this.restTime >= REST_DURATION_S
  }

  /**
   * Adds or removes d6s until there are `count`, from 1 to MAX_DICE. The dice
   * already in the cup stay where they are; see addD6 for where new ones go.
   */
  setDiceCount(count: number, random?: () => number): void {
    const clamped = Math.max(1, Math.min(MAX_DICE, Math.round(count) || 1))
    while (this.dice.length > clamped) this.world.removeRigidBody(this.dice.pop()!)
    while (this.dice.length < clamped) this.addD6(random)
    this.dieIndex = new Map(this.dice.map((die, index) => [die.handle, index]))
  }

  /**
   * Adds a d6 lying flat on the floor, clear of the dice already there, or
   * dropped in on top of them when the floor is full. With `random`, it lies
   * at a random place with a random face up and a random turn, as if left
   * from the last roll; without, it lies on a grid out from the middle with
   * the 3 up, for repeatable tests and debugging.
   */
  private addD6(random?: () => number): void {
    const { RigidBodyDesc, ColliderDesc } = this.rapier
    const { position, rotation } = this.placeD6(random)
    const body = this.world.createRigidBody(
      RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(rotation)
        // A hard shake moves a die further than its own size in one step.
        .setCcdEnabled(true),
    )
    // roundCuboid takes the half extents of the inner box, before rounding.
    const inner = D6_SIZE / 2 - D6_EDGE_RADIUS
    this.world.createCollider(
      ColliderDesc.roundCuboid(inner, inner, inner, D6_EDGE_RADIUS)
        .setRestitution(RESTITUTION)
        .setFriction(FRICTION),
      body,
    )
    this.dice.push(body)
  }

  private placeD6(random?: () => number): { position: Vec3, rotation: Quat } {
    const half = D6_SIZE / 2
    const faceUp = random ? FACE_UP_ROTATIONS[Math.floor(random() * FACE_UP_ROTATIONS.length)]! : FACE_UP_ROTATIONS[0]!
    const placed = this.dice.map(die => ({ z: die.translation().z, footprint: footprintOf(die) }))
    // On the floor where there is room; in a crowded cup, just under the
    // glass, from where it falls in on top of the others.
    for (const z of [half, this.box.depth - half]) {
      // Only the dice at about the same height are in the way.
      const others = placed.filter(die => Math.abs(die.z - z) < D6_SIZE).map(die => die.footprint)
      const isFree = (spot: Footprint) => others.every(other => !overlaps(spot, other))
      const spot = random ? this.randomSpot(isFree, random) : this.gridSpot(isFree)
      if (spot) return { position: { x: spot.x, y: spot.y, z }, rotation: multiply(axisAngle(Z_AXIS, spot.turn), faceUp) }
    }
    // Both full, which only a cup far smaller than a phone can be: the
    // solver pushes the dice apart. Square to the walls, with its face.
    return { position: { x: 0, y: 0, z: this.box.depth - half }, rotation: faceUp }
  }

  /** A free spot at a random place and turn, or null if the tries found none. */
  private randomSpot(isFree: (spot: Footprint) => boolean, random: () => number): Footprint | null {
    // Clear of the walls at any turn, which takes half the diagonal; a box
    // too small for that keeps it in the middle.
    const reach = D6_SIZE / 2 * Math.SQRT2
    const rangeX = Math.max(0, this.box.width / 2 - reach)
    const rangeY = Math.max(0, this.box.height / 2 - reach)
    for (let attempt = 0; attempt < PLACE_ATTEMPTS; attempt++) {
      const spot = { x: (2 * random() - 1) * rangeX, y: (2 * random() - 1) * rangeY, turn: random() * 2 * Math.PI }
      if (isFree(spot)) return spot
    }
    return null
  }

  /** The free spot nearest the middle on a grid of dice square to the walls, if any. */
  private gridSpot(isFree: (spot: Footprint) => boolean): Footprint | null {
    const half = D6_SIZE / 2
    const spacing = D6_SIZE + START_GAP
    const columns = Math.floor(Math.max(0, this.box.width / 2 - half) / spacing)
    const rows = Math.floor(Math.max(0, this.box.height / 2 - half) / spacing)
    const spots: Footprint[] = []
    for (let row = -rows; row <= rows; row++) {
      for (let column = -columns; column <= columns; column++) {
        spots.push({ x: column * spacing, y: row * spacing, turn: 0 })
      }
    }
    spots.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))
    return spots.find(isFree) ?? null
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
    // What contacts did to each die over the frame: the summed size and the
    // summed vector of the velocity changes of the steps that count as a hit.
    const hits = this.dice.map(() => ({ speed: 0, change: { x: 0, y: 0, z: 0 } }))
    // Hits between two dice, by the pair: what each side's velocity changed
    // by, summed over the frame. Both sides usually count the same collision.
    const dieHits = new Map<number, { die: number, sides: [number, number] }>()
    const gravity = this.world.gravity
    const threshold = IMPACT_GRAVITY_MULTIPLE * length(gravity) * FIXED_DT + IMPACT_MIN_SPEED
    // Only a step changes the velocities, so each step's end is the next one's start.
    const velocities = this.dice.map(die => die.linvel())
    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT
      this.world.step()
      hits.forEach((hit, index) => {
        const before = velocities[index]!
        const after = velocities[index] = this.dice[index]!.linvel()
        const change = {
          x: after.x - before.x - gravity.x * FIXED_DT,
          y: after.y - before.y - gravity.y * FIXED_DT,
          z: after.z - before.z - gravity.z * FIXED_DT,
        }
        const speed = length(change)
        if (speed < threshold) return
        const other = this.struckDie(index, change, speed)
        if (other !== null) {
          const die = Math.min(index, other)
          const key = die * MAX_DICE + Math.max(index, other)
          const pair = dieHits.get(key) ?? { die, sides: [0, 0] }
          pair.sides[index === die ? 0 : 1] += speed
          dieHits.set(key, pair)
          return
        }
        hit.speed += speed
        hit.change.x += change.x
        hit.change.y += change.y
        hit.change.z += change.z
      })
      this.restTime = this.dice.every(isSlow) ? this.restTime + FIXED_DT : 0
    }
    this._impacts = hits.flatMap(({ speed, change }, die): Impact[] =>
      speed > 0 ? [{ die, speed, surface: surfaceOf(change) }] : [])
    for (const { die, sides } of dieHits.values()) {
      this._impacts.push({ die, speed: Math.max(...sides), surface: 'die' })
    }
  }

  /**
   * The die that a step's velocity `change` (of size `speed`) on die `index`
   * came from, if any: one it touches, and pushed along the line between them.
   * Only asked for a step that counts as a hit: with 12 dice in a hard shake,
   * about 1% of the frame's physics.
   */
  private struckDie(index: number, change: Vec3, speed: number): number | null {
    const collider = this.dice[index]!.collider(0)
    let struck: number | null = null
    this.world.contactPairsWith(collider, (other) => {
      // The cup's colliders have no body.
      if (struck !== null) return
      const otherIndex = this.dieIndex.get(other.parent()?.handle ?? -1)
      if (otherIndex === undefined) return
      this.world.contactPair(collider, other, (manifold) => {
        // Solver contacts are the ones the step pushed on, not merely predicted.
        if (manifold.numSolverContacts() > 0 && Math.abs(dot(manifold.normal(), change)) >= IMPACT_DIE_MIN_ALIGNMENT * speed) {
          struck = otherIndex
        }
      })
    })
    return struck
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
    // A square bar turned 45° along each edge of the glass and the floor
    // leaves a bevel that wide on both faces.
    const alongX = axisAngle(X_AXIS, Math.PI / 4)
    const alongY = axisAngle(Y_AXIS, Math.PI / 4)
    for (const [z, bevel] of [[depth, BEVEL], [0, FLOOR_BEVEL]] as const) {
      const b = bevel / Math.SQRT2
      for (const sign of [-1, 1]) {
        slabs.push({ half: { x: hx, y: b, z: b }, centre: { x: 0, y: sign * hy, z }, side: true, rotation: alongX })
        slabs.push({ half: { x: b, y: hy, z: b }, centre: { x: sign * hx, y: 0, z }, side: true, rotation: alongY })
      }
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

/** Where a die lying flat sits on the floor: its centre, and its turn about z. */
interface Footprint {
  x: number
  y: number
  turn: number
}

/**
 * Where `die` sits, taken as lying flat. A die left leaning on another after
 * a roll is not, and then its turn is only roughly right.
 */
function footprintOf(die: RigidBody): Footprint {
  const { x, y } = die.translation()
  // Any of the die's own axes that lies flat gives its turn, a square being
  // the same every quarter turn.
  let side = rotate(X_AXIS, die.rotation())
  if (Math.abs(side.z) > Math.SQRT1_2) side = rotate(Y_AXIS, die.rotation())
  return { x, y, turn: Math.atan2(side.y, side.x) }
}

/**
 * Whether two dice lying flat come within PLACE_GAP of each other, by the
 * separating axis test: two squares are apart when their shadows on one of
 * their four edge directions are.
 */
function overlaps(a: Footprint, b: Footprint): boolean {
  // How far a square of the die's size reaches along a direction `angle` off its edges.
  const extent = (angle: number) => D6_SIZE / 2 * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)))
  return [a.turn, a.turn + Math.PI / 2, b.turn, b.turn + Math.PI / 2].every((axis) => {
    const along = Math.abs((b.x - a.x) * Math.cos(axis) + (b.y - a.y) * Math.sin(axis))
    return along < extent(a.turn - axis) + extent(b.turn - axis) + PLACE_GAP
  })
}

/** A uniformly random unit vector: z uniform in [-1, 1], longitude uniform. */
function randomDirection(random: () => number): Vec3 {
  const z = 2 * random() - 1
  const longitude = 2 * Math.PI * random()
  const r = Math.sqrt(1 - z * z)
  return { x: r * Math.cos(longitude), y: r * Math.sin(longitude), z }
}

/** What a die hit, from which way the hit changed its velocity. */
function surfaceOf(change: Vec3): Surface {
  const up = change.z / length(change)
  if (up > IMPACT_FLOOR_MIN_Z) return 'floor'
  if (up < -IMPACT_FLOOR_MIN_Z) return 'glass'
  return 'wall'
}

function isSlow(die: RigidBody): boolean {
  return die.isSleeping()
    || (length(die.linvel()) < REST_LINEAR_SPEED && length(die.angvel()) < REST_ANGULAR_SPEED)
}
