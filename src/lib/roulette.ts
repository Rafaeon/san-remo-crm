// Matemática da roleta visual: o giro é decorativo; o vencedor vem do round-robin no servidor.
export function segmentCenterAngle(index: number, count: number): number {
  return ((index + 0.5) * 360) / count;
}
export function landingRotation(from: number, winnerIndex: number, count: number, minTurns = 3): number {
  const targetMod = (360 - (segmentCenterAngle(winnerIndex, count) % 360)) % 360;
  const min = from + minTurns * 360;
  return targetMod + Math.ceil((min - targetMod) / 360) * 360;
}
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
