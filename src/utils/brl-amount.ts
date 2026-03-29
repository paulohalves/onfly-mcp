export function brlMajorToMinorUnits(major: number): number {
  return Math.round(major * 100 + Number.EPSILON);
}
