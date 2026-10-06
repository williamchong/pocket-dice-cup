import { describe, expect, it } from 'vitest'
import { readFace, TOWARDS_FLOOR } from '../../app/engine/dice/faces'
import { DIE_KINDS, DIE_SHAPES, faceLabel, POLYHEDRA } from '../../app/engine/dice/shapes'
import { dot, length, rotationBetween } from '../../app/engine/math'

const SIDES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 }

describe('die shapes', () => {
  it.each(DIE_KINDS)('numbers a %s 1 to n, one value a face', (kind) => {
    const values = DIE_SHAPES[kind].faces.map(face => face.value).sort((a, b) => a - b)
    expect(values).toEqual(Array.from({ length: SIDES[kind] }, (_, index) => index + 1))
  })

  it.each(Object.values(POLYHEDRA))('builds the $kind with flat faces, all as far from the middle, facing out', (shape) => {
    for (const face of shape.faces) {
      expect(length(face.normal)).toBeCloseTo(1, 9)
      // Every corner on the face's plane, which also checks the d10's kites are flat.
      for (const corner of face.corners) expect(dot(face.normal, shape.vertices[corner]!)).toBeCloseTo(shape.inradius, 9)
    }
    expect(shape.footprintRadius).toBeLessThanOrEqual(Math.max(...shape.vertices.map(length)))
    // The rounded collider comes out to the faces.
    const { collider } = shape
    if (collider.type !== 'roundConvexHull') throw new Error('expected a hull')
    const hullInradius = Math.min(...shape.faces.map(face => Math.max(...collider.points.map(p => dot(face.normal, p)))))
    expect(hullInradius + collider.radius).toBeCloseTo(shape.inradius, 9)
  })

  it.each(['d6', 'd8', 'd12', 'd20'] as const)('puts opposite faces of a %s adding to n + 1', (kind) => {
    const { faces } = DIE_SHAPES[kind]
    for (const face of faces) {
      const opposite = faces.find(other => dot(other.normal, face.normal) < -0.999)!
      expect(face.value + opposite.value).toBe(SIDES[kind] + 1)
    }
  })

  it('prints a d10 0 to 9, opposite faces adding to 9, and reads the 0 as 10', () => {
    const { faces } = DIE_SHAPES.d10
    expect(faces.map(face => faceLabel('d10', face.value)).sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    for (const face of faces) {
      const opposite = faces.find(other => dot(other.normal, face.normal) < -0.999)!
      expect(Number(faceLabel('d10', face.value)) + Number(faceLabel('d10', opposite.value))).toBe(9)
    }
  })

  it.each(DIE_KINDS)('reads a %s lying on each face', (kind) => {
    const shape = DIE_SHAPES[kind]
    for (const face of shape.faces) {
      const { face: read, alignment } = readFace(shape, rotationBetween(face.normal, TOWARDS_FLOOR))
      expect(alignment).toBeCloseTo(1, 9)
      // A d4 reads the face it lies on; the others, the face opposite.
      if (shape.reads === 'down') expect(read).toBe(face)
      else expect(dot(read.normal, face.normal)).toBeCloseTo(-1, 9)
    }
  })

  it('stands each die about as tall as the 12 mm d6, a d20 the tallest', () => {
    for (const kind of DIE_KINDS) {
      expect(DIE_SHAPES[kind].height).toBeGreaterThanOrEqual(1.1)
      expect(DIE_SHAPES[kind].height).toBeLessThanOrEqual(DIE_SHAPES.d20.height)
    }
  })
})
