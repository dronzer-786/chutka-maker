export type Block = {
  id: string
  text: string
}

export type FlowMode = "column" | "row"

export type FontChoice = "sans" | "serif" | "mono"

export type Settings = {
  mode: FlowMode
  columnCount: number
  fontSize: number // pt
  lineHeight: number
  margin: number // mm, all sides
  columnGap: number // mm
  blockGap: number // mm
  font: FontChoice
  justify: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  mode: "column",
  columnCount: 2,
  fontSize: 9,
  lineHeight: 1.35,
  margin: 12,
  columnGap: 8,
  blockGap: 3,
  font: "sans",
  justify: false,
}

export const A4 = { width: 210, height: 297 } // mm

export const FONT_STACKS: Record<FontChoice, string> = {
  sans: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "var(--font-geist-mono), ui-monospace, monospace",
}
