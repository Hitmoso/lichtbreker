/** Dezelfde kleuren als theme.css, als getallen voor PixiJS. */
export const COLORS = {
  bg: 0x0a1230,
  bgDeep: 0x050a1e,
  surface: 0x141e48,
  plate: 0x0e1739,
  etch: 0x2a3a78,
  wall: 0x1c2756,
  wallEdge: 0x33438a,
  text: 0xe8ecff,
  muted: 0x8d97c8,
  accent: 0xffb938,
  beam: { white: 0xffe8b0, red: 0xff5470, green: 0x3df5a0, blue: 0x4fa8ff },
  crystal: { white: 0xcff4ff, red: 0xff5470, green: 0x3df5a0, blue: 0x4fa8ff },
  mirror: 0xdfe6ff,
  fixedMirror: 0x9aa6d8,
} as const;

export const FONTS = {
  display: '"Unbounded", system-ui, sans-serif',
  body: '"Instrument Sans", system-ui, sans-serif',
} as const;
