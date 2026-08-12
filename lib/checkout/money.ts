export function toPaise(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Money value must be finite.");
  return Math.round(value * 100);
}

export function fromPaise(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Money value must be finite.");
  return Math.round(value) / 100;
}

export function roundMoney(value: number): number {
  return fromPaise(toPaise(value));
}
