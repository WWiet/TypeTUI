import { ASCIIFontRenderable, BoxRenderable, StyledText, TextRenderable, bg, bold, createCliRenderer, fg, type KeyEvent, type TextChunk } from "@opentui/core"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"

const STORAGE_PATH = ".typing-test-settings.json"
const THEME_EXPORT_DIR = ".typing-themes"
const PROMPT_WIDTH = 78
const PROMPT_VIEWPORT_LINES = 3
const DEFAULT_WORD_COUNT = 30
const TIMED_WORD_POOL = 220
const WORD_COUNT_OPTIONS = [30, 50, 100] as const
const TIME_OPTIONS = [15, 30, 60] as const
const BUILTIN_THEME_OPTIONS = ["bananaSplit", "rainbowNight", "githubDark", "purpleOcean"] as const
const SETTINGS_SECTIONS = ["mode", "wordCount", "timeSeconds", "theme", "themeEditor"] as const
const THEME_FIELDS = [
  "background",
  "panel",
  "text",
  "muted",
  "preview",
  "completed",
  "danger",
  "accent",
  "success",
  "help",
  "modal",
  "border",
  "caretBg",
  "caretText",
] as const

const WORD_BANK = [
  "the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog", "time", "light",
  "sound", "dream", "space", "ocean", "river", "stone", "glass", "paper", "winter", "summer",
  "autumn", "spring", "coffee", "energy", "screen", "keyboard", "signal", "system", "vector", "pixel",
  "render", "native", "terminal", "typing", "monkey", "motion", "rhythm", "shadow", "silver", "golden",
  "copper", "velvet", "linen", "thread", "anchor", "rocket", "planet", "saturn", "meteor", "comet",
  "galaxy", "nebula", "quiet", "thunder", "breeze", "forest", "canyon", "summit", "valley", "harbor",
  "canvas", "syntax", "engine", "stream", "buffer", "cursor", "letter", "phrase", "accent", "steady",
  "smooth", "crisp", "glow", "ember", "cinder", "marble", "granite", "ripple", "drift", "lumen",
  "focus", "tempo", "zenith", "atlas", "fable", "ember", "sprint", "racing", "nimbus", "aurora",
  "switch", "window", "center", "middle", "status", "result", "accuracy", "minute", "second", "score",
  "speed", "launch", "simple", "sample", "common", "modern", "future", "gentle", "bright", "silent",
  "method", "design", "layout", "column", "margin", "padding", "border", "direct", "active", "repeat",
  "correct", "mistake", "spirit", "magnet", "cobalt", "ivory", "charcoal", "ashen", "violet", "crimson",
  "banana", "orange", "apple", "grape", "peach", "melon", "berry", "mango", "lemon", "olive",
  "train", "flight", "bridge", "street", "market", "garden", "studio", "record", "signal", "module",
]

type BuiltinThemeName = typeof BUILTIN_THEME_OPTIONS[number]
type ThemeName = string
type WordCountOption = typeof WORD_COUNT_OPTIONS[number]
type TimeOption = typeof TIME_OPTIONS[number]
type TestMode = "words" | "time"
type SettingsSection = typeof SETTINGS_SECTIONS[number]
type ThemeField = typeof THEME_FIELDS[number]

type ThemePalette = {
  background: string
  panel: string
  muted: string
  preview: string
  text: string
  completed: string
  danger: string
  caretBg: string
  caretText: string
  accent: string
  success: string
  help: string
  modal: string
  border: string
}

type AppSettings = {
  mode: TestMode
  wordCount: WordCountOption
  timeSeconds: TimeOption
  theme: ThemeName
}

type PersistedState = {
  settings: AppSettings
  customThemes: Record<string, ThemePalette>
}

type TestState = {
  words: string[]
  targetText: string
  typedText: string
  completed: boolean
  startedAt: number | null
  finishedAt: number | null
  keystrokes: number
  mistakes: number
}

type PromptAnimation = {
  fromLineIndex: number
  toLineIndex: number
}

type TestStats = {
  wpm: number
  accuracy: number
  durationSeconds: number
}

const BUILTIN_THEMES: Record<BuiltinThemeName, ThemePalette> = {
  bananaSplit: {
    background: "#241512",
    panel: "#241512",
    muted: "#f6d78b",
    preview: "#7a5a4f",
    text: "#fff4dc",
    completed: "#ffb8c8",
    danger: "#ff4f6d",
    caretBg: "#fff4dc",
    caretText: "#241512",
    accent: "#ff9fba",
    success: "#ffd27f",
    help: "#b8aca3",
    modal: "#2d1a16",
    border: "#ff9fba",
  },
  rainbowNight: {
    background: "#12131a",
    panel: "#12131a",
    muted: "#ffd166",
    preview: "#4b4e68",
    text: "#f8f9ff",
    completed: "#72f1b8",
    danger: "#ff5d8f",
    caretBg: "#f8f9ff",
    caretText: "#12131a",
    accent: "#7aa2ff",
    success: "#ffb703",
    help: "#98a0b9",
    modal: "#1a1c25",
    border: "#7aa2ff",
  },
  githubDark: {
    background: "#0d1117",
    panel: "#0d1117",
    muted: "#c9d1d9",
    preview: "#484f58",
    text: "#f0f6fc",
    completed: "#79c0ff",
    danger: "#ff7b72",
    caretBg: "#f0f6fc",
    caretText: "#0d1117",
    accent: "#58a6ff",
    success: "#3fb950",
    help: "#8b949e",
    modal: "#161b22",
    border: "#30363d",
  },
  purpleOcean: {
    background: "#14111f",
    panel: "#14111f",
    muted: "#a9b8ff",
    preview: "#4d456c",
    text: "#f6f0ff",
    completed: "#7ce7ff",
    danger: "#ff6ba2",
    caretBg: "#f6f0ff",
    caretText: "#14111f",
    accent: "#b58cff",
    success: "#7ce7ff",
    help: "#9a96b3",
    modal: "#1b1630",
    border: "#6c63ff",
  },
}

const DEFAULT_CUSTOM_THEME_NAME = "my-theme"
const DEFAULT_CUSTOM_THEME = { ...BUILTIN_THEMES.bananaSplit }

let settings: AppSettings = {
  mode: "words",
  wordCount: DEFAULT_WORD_COUNT,
  timeSeconds: 30,
  theme: "bananaSplit",
}

let customThemes: Record<string, ThemePalette> = {
  [DEFAULT_CUSTOM_THEME_NAME]: { ...DEFAULT_CUSTOM_THEME },
}

const persisted = await loadPersistedState()

if (persisted != null) {
  settings = persisted.settings
  customThemes = Object.keys(persisted.customThemes).length > 0 ? persisted.customThemes : customThemes
}

if (!isBuiltinTheme(settings.theme) && customThemes[settings.theme] == null) {
  settings.theme = "bananaSplit"
}

let draftSettings: AppSettings = { ...settings }
let draftCustomThemeName = getInitialThemeEditorName(settings.theme)
let draftCustomTheme: ThemePalette = { ...getThemePalette(draftCustomThemeName) }

let state = createState()
let promptAnimation: PromptAnimation | null = null
let promptAnimationTimer: ReturnType<typeof setTimeout> | null = null
let timerInterval: ReturnType<typeof setInterval> | null = null
let appDestroyed = false

let settingsOpen = false
let themeEditorOpen = false
let colorPickerOpen = false
let renameThemeOpen = false

let selectedSettingsSection = 0
let selectedThemeFieldIndex = 0
let settingsArrowBlinkVisible = true
let colorPickerField: ThemeField | null = null
let colorPickerOriginalColor = ""
let colorPickerInput = ""
let draftThemeNameInput = draftCustomThemeName

const renderer = await createCliRenderer({
  useConsole: false,
  openConsoleOnError: false,
  exitOnCtrlC: true,
})

const progressDisplay = new ASCIIFontRenderable(renderer, {
  text: "0",
  font: "block",
  alignSelf: "center",
  marginBottom: 1,
})

const wordsViewport = new BoxRenderable(renderer, {
  width: "100%",
  height: PROMPT_VIEWPORT_LINES,
  flexDirection: "column",
  overflow: "hidden",
})

const wordsDisplay = new TextRenderable(renderer, {
  content: "",
  width: "100%",
  height: PROMPT_VIEWPORT_LINES,
  wrapMode: "none",
  selectable: false,
})

const statsDisplay = new TextRenderable(renderer, {
  content: "",
  width: "100%",
  height: 2,
  wrapMode: "word",
  selectable: false,
  marginTop: 1,
})

const helperDisplay = new TextRenderable(renderer, {
  content: "",
  width: "100%",
  height: 2,
  wrapMode: "word",
  selectable: false,
  marginTop: 1,
})

const content = new BoxRenderable(renderer, {
  width: 86,
  maxWidth: "100%",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "stretch",
  paddingX: 2,
  paddingY: 1,
})

const app = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
})

const settingsOverlay = createOverlay(renderer, 10)
const settingsModal = createModal(renderer, 62)
const settingsTitleDisplay = createModalText(renderer)
const settingsBodyDisplay = createModalText(renderer, 1)
const settingsHintDisplay = createModalText(renderer, 1)

const themeEditorOverlay = createOverlay(renderer, 20)
const themeEditorModal = createModal(renderer, 66)
const themeEditorTitleDisplay = createModalText(renderer)
const themeEditorBodyDisplay = createModalText(renderer, 1)
const themeEditorHintDisplay = createModalText(renderer, 1)

const colorPickerOverlay = createOverlay(renderer, 30)
const colorPickerModal = createModal(renderer, 56)
const colorPickerTitleDisplay = createModalText(renderer)
const colorPickerBodyDisplay = createModalText(renderer, 1)
const colorPickerHintDisplay = createModalText(renderer, 1)

content.add(progressDisplay)
wordsViewport.add(wordsDisplay)
content.add(wordsViewport)
content.add(statsDisplay)
content.add(helperDisplay)

settingsModal.add(settingsTitleDisplay)
settingsModal.add(settingsBodyDisplay)
settingsModal.add(settingsHintDisplay)
settingsOverlay.add(settingsModal)

themeEditorModal.add(themeEditorTitleDisplay)
themeEditorModal.add(themeEditorBodyDisplay)
themeEditorModal.add(themeEditorHintDisplay)
themeEditorOverlay.add(themeEditorModal)

colorPickerModal.add(colorPickerTitleDisplay)
colorPickerModal.add(colorPickerBodyDisplay)
colorPickerModal.add(colorPickerHintDisplay)
colorPickerOverlay.add(colorPickerModal)

app.add(content)
app.add(settingsOverlay)
app.add(themeEditorOverlay)
app.add(colorPickerOverlay)
renderer.root.add(app)

applyTheme()
startTimerLoop()
updateView()

renderer.on("destroy", () => {
  appDestroyed = true
  clearPromptAnimation()

  if (timerInterval != null) {
    clearInterval(timerInterval)
    timerInterval = null
  }
})

renderer.keyInput.on("keypress", (key: KeyEvent) => {
  if (key.ctrl && key.name === "c") {
    destroyApp()
    return
  }

  if (colorPickerOpen) {
    handleColorPickerKey(key)
    return
  }

  if (themeEditorOpen) {
    handleThemeEditorKey(key)
    return
  }

  if (key.ctrl && key.name === "s") {
    if (settingsOpen) {
      applySettingsAndClose()
    } else {
      openSettings()
    }
    return
  }

  if (settingsOpen) {
    handleSettingsKey(key)
    return
  }

  if (key.name === "escape") {
    destroyApp()
    return
  }

  if (key.ctrl && key.name === "r") {
    resetTest()
    return
  }

  if (key.name === "backspace") {
    if (state.typedText.length > 0 && !state.completed) {
      clearPromptAnimation()
      state.typedText = state.typedText.slice(0, -1)
      updateView()
    }
    return
  }

  if (key.name === "return" && state.completed) {
    resetTest()
    return
  }

  if (key.sequence.length !== 1 || key.ctrl || key.meta || state.completed) {
    return
  }

  if (state.startedAt == null) {
    state.startedAt = Date.now()
  }

  if (state.typedText.length >= state.targetText.length) {
    return
  }

  const previousLineIndex = getCurrentLineIndex(state)
  const char = key.sequence
  const expected = state.targetText[state.typedText.length] ?? ""

  state.typedText += char
  state.keystrokes += 1

  if (char !== expected) {
    state.mistakes += 1
  }

  if (settings.mode === "words" && state.typedText === state.targetText) {
    state.completed = true
    state.finishedAt = Date.now()
  }

  const nextLineIndex = getCurrentLineIndex(state)

  if (nextLineIndex > previousLineIndex) {
    startLineTransition(previousLineIndex, nextLineIndex)
  }

  updateView()
})

function createOverlay(ctx: typeof renderer, zIndex: number): BoxRenderable {
  return new BoxRenderable(ctx, {
    width: "100%",
    height: "100%",
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    visible: false,
    zIndex,
  })
}

function createModal(ctx: typeof renderer, width: number): BoxRenderable {
  return new BoxRenderable(ctx, {
    width,
    maxWidth: "100%",
    flexDirection: "column",
    border: true,
    borderStyle: "rounded",
    padding: 1,
  })
}

function createModalText(ctx: typeof renderer, marginTop = 0): TextRenderable {
  return new TextRenderable(ctx, {
    content: "",
    width: "100%",
    wrapMode: "word",
    selectable: false,
    marginTop,
  })
}

function createState(): TestState {
  const words = pickWords(getTargetWordCount())
  return {
    words,
    targetText: words.join(" "),
    typedText: "",
    completed: false,
    startedAt: null,
    finishedAt: null,
    keystrokes: 0,
    mistakes: 0,
  }
}

function resetTest(): void {
  clearPromptAnimation()
  state = createState()
  updateView()
}

function pickWords(count: number): string[] {
  const words: string[] = []

  while (words.length < count) {
    const shuffled = [...WORD_BANK]

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      const current = shuffled[index] ?? ""
      shuffled[index] = shuffled[swapIndex] ?? ""
      shuffled[swapIndex] = current
    }

    words.push(...shuffled)
  }

  return words.slice(0, count)
}

function updateView(): void {
  if (appDestroyed || renderer.isDestroyed) {
    return
  }

  applyTheme()
  progressDisplay.text = formatProgress(state)
  wordsDisplay.content = buildStyledPrompt(state)
  statsDisplay.content = buildStats(state)
  helperDisplay.content = buildHelper(state)
  updateSettingsModal()
  updateThemeEditorModal()
  updateColorPickerModal()
  renderer.requestRender()
}

function applyTheme(): void {
  progressDisplay.color = colors().text
  wordsDisplay.fg = colors().muted
  content.backgroundColor = colors().panel
  app.backgroundColor = colors().background
  settingsModal.backgroundColor = colors().modal
  settingsModal.borderColor = colors().border
  themeEditorModal.backgroundColor = colors().modal
  themeEditorModal.borderColor = colors().border
  colorPickerModal.backgroundColor = colors().modal
  colorPickerModal.borderColor = colors().border
}

function startLineTransition(fromLineIndex: number, toLineIndex: number): void {
  clearPromptAnimation()
  promptAnimation = { fromLineIndex, toLineIndex }
  promptAnimationTimer = setTimeout(() => {
    if (appDestroyed || renderer.isDestroyed) {
      return
    }

    promptAnimation = null
    promptAnimationTimer = null
    updateView()
  }, 140)
}

function clearPromptAnimation(): void {
  if (promptAnimationTimer != null) {
    clearTimeout(promptAnimationTimer)
    promptAnimationTimer = null
  }

  promptAnimation = null
}

function formatProgress(currentState: TestState): string {
  if (settings.mode === "time") {
    return `${Math.ceil(getRemainingTimeSeconds(currentState))}`
  }

  return `${countCompletedWords(currentState)}/${settings.wordCount}`
}

function countCompletedWords(currentState: TestState): number {
  let completedWords = 0
  let offset = 0

  for (let index = 0; index < currentState.words.length; index += 1) {
    const word = currentState.words[index] ?? ""
    const typedSlice = currentState.typedText.slice(offset, offset + word.length)

    if (typedSlice !== word) {
      break
    }

    completedWords += 1
    offset += word.length

    if (index < currentState.words.length - 1) {
      if (currentState.typedText[offset] !== " ") {
        completedWords -= 1
        break
      }

      offset += 1
    }
  }

  return completedWords
}

function buildStyledPrompt(currentState: TestState): StyledText {
  const wordRanges = getWordRanges(currentState.words)
  const wrappedLines = wrapWordRanges(currentState.words, PROMPT_WIDTH)
  const activeLineIndex = getCurrentLineIndex(currentState)
  const lineIndexes = promptAnimation == null
    ? [activeLineIndex - 1, activeLineIndex, activeLineIndex + 1]
    : [promptAnimation.fromLineIndex, promptAnimation.toLineIndex, promptAnimation.toLineIndex + 1]

  const chunks: TextChunk[] = []

  for (let viewIndex = 0; viewIndex < lineIndexes.length; viewIndex += 1) {
    const lineIndex = lineIndexes[viewIndex] ?? -1
    const tone = viewIndex === 1 ? "active" : "preview"

    if (lineIndex >= 0 && lineIndex < wrappedLines.length) {
      chunks.push(...buildStyledLine(currentState, wrappedLines[lineIndex] ?? [], wordRanges, tone))
    }

    if (viewIndex < lineIndexes.length - 1) {
      chunks.push(fg(colors().help)("\n"))
    }
  }

  return new StyledText(chunks)
}

function buildStyledLine(
  currentState: TestState,
  line: number[],
  wordRanges: Array<{ start: number; end: number }>,
  tone: "active" | "preview",
): TextChunk[] {
  const chunks: TextChunk[] = []
  const caretIndex = currentState.typedText.length

  for (let wordIndex = 0; wordIndex < line.length; wordIndex += 1) {
    const range = wordRanges[line[wordIndex] ?? 0]

    if (range == null) {
      continue
    }

    for (let charIndex = range.start; charIndex < range.end; charIndex += 1) {
      chunks.push(getStyledChar(currentState, charIndex, caretIndex, tone))
    }

    if (wordIndex < line.length - 1) {
      chunks.push(getStyledChar(currentState, range.end, caretIndex, tone))
    }
  }

  return chunks
}

function getStyledChar(currentState: TestState, index: number, caretIndex: number, tone: "active" | "preview"): TextChunk {
  const expected = currentState.targetText[index] ?? ""
  const typed = currentState.typedText[index]
  const upcomingColor = tone === "active" ? colors().muted : colors().preview
  const correctColor = tone === "active" ? colors().completed : colors().preview

  if (typed == null) {
    if (!currentState.completed && index === caretIndex) {
      return bold(bg(colors().caretBg)(fg(colors().caretText)(expected)))
    }

    return bold(fg(upcomingColor)(expected))
  }

  if (typed === expected) {
    return bold(fg(correctColor)(expected))
  }

  return bold(fg(colors().danger)(typed === " " ? "_" : typed))
}

function getWordRanges(words: string[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = []
  let offset = 0

  for (const word of words) {
    ranges.push({ start: offset, end: offset + word.length })
    offset += word.length + 1
  }

  return ranges
}

function wrapWordRanges(words: string[], maxWidth: number): number[][] {
  const lines: number[][] = []
  let currentLine: number[] = []
  let currentWidth = 0

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? ""
    const nextWidth = currentLine.length === 0 ? word.length : currentWidth + 1 + word.length

    if (currentLine.length > 0 && nextWidth > maxWidth) {
      lines.push(currentLine)
      currentLine = [index]
      currentWidth = word.length
      continue
    }

    currentLine.push(index)
    currentWidth = nextWidth
  }

  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  return lines
}

function getCurrentWordIndex(currentState: TestState, ranges: Array<{ start: number; end: number }>): number {
  const caretIndex = currentState.completed
    ? Math.max(currentState.targetText.length - 1, 0)
    : currentState.typedText.length

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index]

    if (range != null && caretIndex <= range.end) {
      return index
    }
  }

  return Math.max(ranges.length - 1, 0)
}

function findLineIndexForWord(lines: number[][], wordIndex: number): number {
  for (let index = 0; index < lines.length; index += 1) {
    if ((lines[index] ?? []).includes(wordIndex)) {
      return index
    }
  }

  return 0
}

function getCurrentLineIndex(currentState: TestState): number {
  const ranges = getWordRanges(currentState.words)
  const wordIndex = getCurrentWordIndex(currentState, ranges)
  return findLineIndexForWord(wrapWordRanges(currentState.words, PROMPT_WIDTH), wordIndex)
}

function buildStats(currentState: TestState): StyledText {
  if (!currentState.completed) {
    return line(colors().help, "finish the test to see wpm and accuracy")
  }

  const stats = calculateStats(currentState)

  return new StyledText([
    fg(colors().help)("WPM "),
    fg(colors().success)(stats.wpm.toFixed(1)),
    fg(colors().help)("   ACC "),
    fg(colors().completed)(`${stats.accuracy.toFixed(1)}%`),
    fg(colors().help)("   TIME "),
    fg(colors().text)(`${stats.durationSeconds.toFixed(1)}s`),
  ])
}

function buildHelper(currentState: TestState): StyledText {
  if (currentState.completed) {
    return line(colors().help, "done - enter restart, ctrl+r reset, ctrl+s settings, esc quit")
  }

  return line(colors().help, "type the prompt - ctrl+r reset, ctrl+s settings")
}

function calculateStats(currentState: TestState): TestStats {
  const endTime = currentState.finishedAt ?? Date.now()
  const startTime = currentState.startedAt ?? endTime
  const elapsedMs = Math.max(endTime - startTime, 1)
  const correctChars = Math.max(currentState.keystrokes - currentState.mistakes, 0)

  return {
    wpm: Math.max((correctChars / 5) / (elapsedMs / 60000), 0),
    accuracy: currentState.keystrokes === 0 ? 100 : Math.max(0, Math.min((correctChars / currentState.keystrokes) * 100, 100)),
    durationSeconds: elapsedMs / 1000,
  }
}

function getTargetWordCount(): number {
  return settings.mode === "words" ? settings.wordCount : TIMED_WORD_POOL
}

function getRemainingTimeSeconds(currentState: TestState): number {
  if (settings.mode !== "time") {
    return settings.wordCount
  }

  if (currentState.startedAt == null) {
    return settings.timeSeconds
  }

  const end = currentState.completed ? (currentState.finishedAt ?? currentState.startedAt) : Date.now()
  return Math.max(settings.timeSeconds - (end - currentState.startedAt) / 1000, 0)
}

function startTimerLoop(): void {
  if (timerInterval != null) {
    clearInterval(timerInterval)
  }

  timerInterval = setInterval(() => {
    if (appDestroyed || renderer.isDestroyed) {
      return
    }

    settingsArrowBlinkVisible = !settingsArrowBlinkVisible

    if (settings.mode === "time" && !settingsOpen && !state.completed && state.startedAt != null) {
      if (getRemainingTimeSeconds(state) <= 0) {
        state.completed = true
        state.finishedAt = state.startedAt + settings.timeSeconds * 1000
      }
    }

    updateView()
  }, 120)
}

function openSettings(): void {
  settingsOpen = true
  draftSettings = { ...settings }
  draftCustomThemeName = getInitialThemeEditorName(draftSettings.theme)
  draftCustomTheme = { ...getThemePalette(draftCustomThemeName) }
  selectedSettingsSection = 0
  settingsOverlay.visible = true
  updateView()
}

function closeSettings(): void {
  settingsOpen = false
  themeEditorOpen = false
  colorPickerOpen = false
  renameThemeOpen = false
  settingsOverlay.visible = false
  themeEditorOverlay.visible = false
  colorPickerOverlay.visible = false
  updateView()
}

function applySettingsAndClose(): void {
  if (!isBuiltinTheme(draftSettings.theme)) {
    customThemes[draftSettings.theme] = { ...draftCustomTheme }
  }

  const changed = JSON.stringify(settings) !== JSON.stringify(draftSettings)
  settings = { ...draftSettings }
  void persistState()

  if (changed) {
    resetTest()
  }

  closeSettings()
}

function handleSettingsKey(key: KeyEvent): void {
  if (key.name === "escape") {
    closeSettings()
    return
  }

  if (key.name === "return") {
    if (SETTINGS_SECTIONS[selectedSettingsSection] === "themeEditor") {
      openThemeEditor()
    } else {
      applySettingsAndClose()
    }
    return
  }

  if (key.name === "up" || key.sequence === "k") {
    selectedSettingsSection = (selectedSettingsSection + SETTINGS_SECTIONS.length - 1) % SETTINGS_SECTIONS.length
    updateView()
    return
  }

  if (key.name === "down" || key.sequence === "j" || key.name === "tab") {
    selectedSettingsSection = (selectedSettingsSection + 1) % SETTINGS_SECTIONS.length
    updateView()
    return
  }

  if (key.name === "left" || key.sequence === "h") {
    stepSetting(-1)
    return
  }

  if (key.name === "right" || key.sequence === "l") {
    stepSetting(1)
  }
}

function stepSetting(direction: -1 | 1): void {
  const section = SETTINGS_SECTIONS[selectedSettingsSection]

  if (section === "mode") {
    draftSettings.mode = stepValue(["words", "time"], draftSettings.mode, direction)
  }

  if (section === "wordCount") {
    draftSettings.wordCount = stepValue(WORD_COUNT_OPTIONS, draftSettings.wordCount, direction)
  }

  if (section === "timeSeconds") {
    draftSettings.timeSeconds = stepValue(TIME_OPTIONS, draftSettings.timeSeconds, direction)
  }

  if (section === "theme") {
    draftSettings.theme = stepValue(getThemeOptions(), draftSettings.theme, direction)
    if (!isBuiltinTheme(draftSettings.theme)) {
      draftCustomThemeName = draftSettings.theme
      draftCustomTheme = { ...getThemePalette(draftSettings.theme) }
    }
  }

  updateView()
}

function updateSettingsModal(): void {
  settingsTitleDisplay.content = new StyledText([
    fg(colors().accent)("Settings"),
    fg(colors().help)("  ctrl+s apply  esc close"),
  ])

  settingsBodyDisplay.content = new StyledText([
    ...buildSettingsLine("mode", `Test Type   ${draftSettings.mode === "words" ? "Words" : "Timed"}`),
    fg(colors().help)("\n"),
    ...buildSettingsLine("wordCount", `Word Count  ${draftSettings.wordCount}`),
    fg(colors().help)("\n"),
    ...buildSettingsLine("timeSeconds", `Time Limit  ${draftSettings.timeSeconds}s`),
    fg(colors().help)("\n"),
    ...buildSettingsLine("theme", `Theme       ${formatThemeName(draftSettings.theme)}`),
    fg(colors().help)("\n"),
    ...buildSettingsLine("themeEditor", "Theme Edit  Open creator"),
  ])

  settingsHintDisplay.content = line(colors().help, "arrows or hjkl move  enter open/apply  esc close")
}

function buildSettingsLine(section: SettingsSection, label: string): TextChunk[] {
  const isSelected = SETTINGS_SECTIONS[selectedSettingsSection] === section
  const inactive = (section === "wordCount" && draftSettings.mode !== "words") || (section === "timeSeconds" && draftSettings.mode !== "time")
  const baseColor = inactive ? colors().preview : colors().text

  if (!isSelected) {
    return [fg(baseColor)(label)]
  }

  const arrows = getSettingArrows(section)
  return [bg(colors().accent)(fg(colors().background)(`${arrows.left}${label}${arrows.right}`))]
}

function getSettingArrows(section: SettingsSection): { left: string; right: string } {
  const state = getSettingArrowState(section)
  return {
    left: state.canDecrease && settingsArrowBlinkVisible ? "< " : "  ",
    right: state.canIncrease && settingsArrowBlinkVisible ? " >" : "  ",
  }
}

function getSettingArrowState(section: SettingsSection): { canDecrease: boolean; canIncrease: boolean } {
  if (section === "mode") {
    return getOptionBounds(["words", "time"], draftSettings.mode)
  }

  if (section === "wordCount") {
    return getOptionBounds(WORD_COUNT_OPTIONS, draftSettings.wordCount)
  }

  if (section === "timeSeconds") {
    return getOptionBounds(TIME_OPTIONS, draftSettings.timeSeconds)
  }

  if (section === "themeEditor") {
    return { canDecrease: false, canIncrease: true }
  }

  return getOptionBounds(getThemeOptions(), draftSettings.theme)
}

function openThemeEditor(): void {
  themeEditorOpen = true
  renameThemeOpen = false
  colorPickerOpen = false
  selectedThemeFieldIndex = 0
  draftCustomThemeName = getInitialThemeEditorName(draftSettings.theme)
  draftThemeNameInput = draftCustomThemeName
  draftCustomTheme = { ...getThemePalette(draftSettings.theme) }
  if (isBuiltinTheme(draftSettings.theme)) {
    draftSettings.theme = draftCustomThemeName
  }
  themeEditorOverlay.visible = true
  colorPickerOverlay.visible = false
  updateView()
}

function closeThemeEditor(): void {
  themeEditorOpen = false
  colorPickerOpen = false
  renameThemeOpen = false
  themeEditorOverlay.visible = false
  colorPickerOverlay.visible = false
  updateView()
}

function handleThemeEditorKey(key: KeyEvent): void {
  if (renameThemeOpen) {
    handleRenameThemeKey(key)
    return
  }

  if (key.name === "escape") {
    closeThemeEditor()
    return
  }

  if (key.sequence === "n") {
    renameThemeOpen = true
    draftThemeNameInput = draftCustomThemeName
    updateView()
    return
  }

  if (key.sequence === "s") {
    saveDraftThemeAsNew()
    return
  }

  if (key.sequence === "w") {
    overwriteCurrentTheme()
    return
  }

  if (key.sequence === "d") {
    deleteCurrentCustomTheme()
    return
  }

  if (key.sequence === "e") {
    void exportCurrentTheme()
    return
  }

  if (key.sequence === "i") {
    void importThemesFromDisk()
    return
  }

  if (key.name === "up" || key.sequence === "k") {
    selectedThemeFieldIndex = Math.max(selectedThemeFieldIndex - 1, 0)
    updateView()
    return
  }

  if (key.name === "down" || key.sequence === "j") {
    selectedThemeFieldIndex = Math.min(selectedThemeFieldIndex + 1, THEME_FIELDS.length - 1)
    updateView()
    return
  }

  if (key.name === "return" || key.name === "right" || key.sequence === "l") {
    openColorPicker(THEME_FIELDS[selectedThemeFieldIndex] ?? "background")
  }
}

function handleRenameThemeKey(key: KeyEvent): void {
  if (key.name === "escape") {
    renameThemeOpen = false
    draftThemeNameInput = draftCustomThemeName
    updateView()
    return
  }

  if (key.name === "return") {
    draftCustomThemeName = sanitizeThemeName(draftThemeNameInput)
    draftThemeNameInput = draftCustomThemeName
    draftSettings.theme = draftCustomThemeName
    renameThemeOpen = false
    updateView()
    return
  }

  if (key.name === "backspace") {
    draftThemeNameInput = draftThemeNameInput.slice(0, -1)
    updateView()
    return
  }

  if (key.sequence.length === 1 && !key.ctrl && !key.meta) {
    draftThemeNameInput += key.sequence
    updateView()
  }
}

function saveDraftThemeAsNew(): void {
  const nextName = getNextCustomThemeName(draftThemeNameInput || draftCustomThemeName)
  customThemes[nextName] = { ...draftCustomTheme }
  draftCustomThemeName = nextName
  draftThemeNameInput = nextName
  draftSettings.theme = nextName
  void persistState()
  updateView()
}

function overwriteCurrentTheme(): void {
  customThemes[draftCustomThemeName] = { ...draftCustomTheme }
  draftSettings.theme = draftCustomThemeName
  void persistState()
  updateView()
}

async function exportCurrentTheme(): Promise<void> {
  await mkdir(THEME_EXPORT_DIR, { recursive: true })
  const filePath = `${THEME_EXPORT_DIR}/${draftCustomThemeName}.json`
  await writeFile(filePath, `${JSON.stringify({ name: draftCustomThemeName, palette: draftCustomTheme }, null, 2)}\n`, "utf8")
}

async function importThemesFromDisk(): Promise<void> {
  await mkdir(THEME_EXPORT_DIR, { recursive: true })
  const files = await readdir(THEME_EXPORT_DIR)

  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue
    }

    try {
      const parsed = JSON.parse(await readFile(`${THEME_EXPORT_DIR}/${file}`, "utf8")) as { name?: string; palette?: unknown }
      const importedName = sanitizeThemeName(parsed.name ?? file.replace(/\.json$/, ""))

      if (isThemePalette(parsed.palette)) {
        customThemes[importedName] = parsed.palette
      }
    } catch {
      continue
    }
  }

  if (customThemes[draftCustomThemeName] != null) {
    draftCustomTheme = { ...customThemes[draftCustomThemeName]! }
  }

  void persistState()
  updateView()
}

function openColorPicker(field: ThemeField): void {
  colorPickerField = field
  colorPickerOriginalColor = draftCustomTheme[field]
  colorPickerInput = draftCustomTheme[field]
  colorPickerOpen = true
  colorPickerOverlay.visible = true
  updateView()
}

function handleColorPickerKey(key: KeyEvent): void {
  if (key.name === "escape") {
    closeColorPicker(false)
    return
  }

  if (key.name === "return") {
    closeColorPicker(true)
    return
  }

  if (key.name === "backspace") {
    colorPickerInput = colorPickerInput.slice(0, -1)
    previewColorInput()
    return
  }

  if (key.sequence.length === 1 && /[0-9a-fA-F#]/.test(key.sequence)) {
    colorPickerInput += key.sequence
    previewColorInput()
  }
}

function closeColorPicker(save: boolean): void {
  if (colorPickerField != null && (!save || !isHexColor(colorPickerInput))) {
    draftCustomTheme[colorPickerField] = colorPickerOriginalColor
  }

  if (save && colorPickerField != null && isHexColor(colorPickerInput)) {
    draftCustomTheme[colorPickerField] = normalizeHexColor(colorPickerInput)
  }

  colorPickerOpen = false
  colorPickerOverlay.visible = false
  colorPickerField = null
  updateView()
}

function previewColorInput(): void {
  if (colorPickerField == null) {
    return
  }

  if (isHexColor(colorPickerInput)) {
    draftCustomTheme[colorPickerField] = normalizeHexColor(colorPickerInput)
    draftSettings.theme = draftCustomThemeName
  }

  updateView()
}

function updateThemeEditorModal(): void {
  themeEditorTitleDisplay.content = new StyledText([
    fg(colors().accent)("Theme Creator"),
    fg(colors().help)(`  editing ${draftCustomThemeName}`),
  ])

  const chunks: TextChunk[] = [
    fg(colors().help)("Theme Name   "),
    renameThemeOpen
      ? bg(colors().accent)(fg(colors().background)(` ${draftThemeNameInput || " "} `))
      : fg(colors().text)(draftCustomThemeName),
    fg(colors().help)("\nSave Slot    "),
    fg(colors().accent)("s save new   w overwrite   e export   i import\n"),
    fg(colors().help)("Delete Theme "),
    fg(canDeleteCurrentTheme() ? colors().danger : colors().preview)(canDeleteCurrentTheme() ? "press d to delete this saved theme\n\n" : "built-in drafts cannot be deleted\n\n"),
  ]

  for (let index = 0; index < THEME_FIELDS.length; index += 1) {
    const field = THEME_FIELDS[index]

    if (field == null) {
      continue
    }

    if (index > 0) {
      chunks.push(fg(colors().help)("\n"))
    }

    const label = `${formatThemeFieldName(field).padEnd(12, " ")} ${draftCustomTheme[field]}`

    if (index === selectedThemeFieldIndex) {
      chunks.push(bg(colors().accent)(fg(colors().background)(` ${label} `)))
    } else {
      chunks.push(fg(colors().text)(label))
    }

    chunks.push(fg(colors().help)("  "))
    chunks.push(bg(draftCustomTheme[field])(fg(draftCustomTheme[field])("   ")))
  }

  themeEditorBodyDisplay.content = new StyledText(chunks)
  themeEditorHintDisplay.content = line(colors().help, "n rename  s save new  w overwrite  d delete  e export  i import  enter edit hex")
}

function updateColorPickerModal(): void {
  const field = colorPickerField ?? "background"
  const previewColor = isHexColor(colorPickerInput) ? normalizeHexColor(colorPickerInput) : colorPickerOriginalColor

  colorPickerTitleDisplay.content = new StyledText([
    fg(colors().accent)(`${formatThemeFieldName(field)} Hex`),
    fg(colors().help)("  type a hex color"),
  ])
  colorPickerBodyDisplay.content = new StyledText([
    fg(colors().help)("Value   "),
    bg(colors().accent)(fg(colors().background)(` ${colorPickerInput || "#"} `)),
    fg(colors().help)("\n\nPreview "),
    fg(colors().text)(previewColor),
    fg(colors().help)("  "),
    bg(previewColor)(fg(previewColor)("      ")),
    fg(isHexColor(colorPickerInput) ? colors().success : colors().danger)(`\n\n${isHexColor(colorPickerInput) ? "valid hex - enter saves" : "invalid hex - use #RRGGBB or #RGB"}`),
  ])
  colorPickerHintDisplay.content = line(colors().help, "type hex  backspace delete  enter save  esc cancel")
}

function formatThemeName(themeName: ThemeName): string {
  if (!isBuiltinTheme(themeName)) {
    return themeName
  }

  if (themeName === "bananaSplit") return "Banana Split"
  if (themeName === "rainbowNight") return "Rainbow Night"
  if (themeName === "githubDark") return "GitHub Dark"
  return "Purple Ocean"
}

function formatThemeFieldName(field: ThemeField): string {
  const labels: Record<ThemeField, string> = {
    background: "Background",
    panel: "Panel",
    text: "Primary",
    muted: "Upcoming",
    preview: "Preview",
    completed: "Correct",
    danger: "Mistake",
    accent: "Accent",
    success: "Success",
    help: "Help",
    modal: "Modal",
    border: "Border",
    caretBg: "Caret Bg",
    caretText: "Caret Fg",
  }

  return labels[field]
}

function line(color: string, content: string): StyledText {
  return new StyledText([fg(color)(content)])
}

function canDeleteCurrentTheme(): boolean {
  return !isBuiltinTheme(draftCustomThemeName) && customThemes[draftCustomThemeName] != null
}

function deleteCurrentCustomTheme(): void {
  if (!canDeleteCurrentTheme()) {
    return
  }

  delete customThemes[draftCustomThemeName]

  const nextTheme = getThemeOptions().find((theme) => !isBuiltinTheme(theme)) ?? BUILTIN_THEME_OPTIONS[0]
  draftSettings.theme = nextTheme
  draftCustomThemeName = getInitialThemeEditorName(nextTheme)
  draftThemeNameInput = draftCustomThemeName
  draftCustomTheme = { ...getThemePalette(nextTheme) }
  void persistState()
  updateView()
}

function isHexColor(value: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
}

function normalizeHexColor(value: string): string {
  const trimmed = value.trim().replace(/^#?/, "#")

  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
  }

  return trimmed.toLowerCase()
}

function colors(): ThemePalette {
  if (colorPickerOpen || themeEditorOpen) {
    return draftCustomTheme
  }

  if (settingsOpen) {
    return getThemePalette(draftSettings.theme)
  }

  return getThemePalette(settings.theme)
}

function isBuiltinTheme(themeName: ThemeName): themeName is BuiltinThemeName {
  return (BUILTIN_THEME_OPTIONS as readonly string[]).includes(themeName)
}

function getThemeOptions(): ThemeName[] {
  return [...BUILTIN_THEME_OPTIONS, ...Object.keys(customThemes)]
}

function getThemePalette(themeName: ThemeName): ThemePalette {
  if (isBuiltinTheme(themeName)) {
    return BUILTIN_THEMES[themeName]
  }

  return customThemes[themeName] ?? DEFAULT_CUSTOM_THEME
}

function getInitialThemeEditorName(baseThemeName: ThemeName): string {
  if (!isBuiltinTheme(baseThemeName) && customThemes[baseThemeName] != null) {
    return baseThemeName
  }

  return getNextCustomThemeName(baseThemeName === "bananaSplit" ? DEFAULT_CUSTOM_THEME_NAME : `${baseThemeName}-mix`)
}

function sanitizeThemeName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/\s+/g, "-")
  return normalized === "" ? DEFAULT_CUSTOM_THEME_NAME : normalized
}

function getNextCustomThemeName(baseName: string): string {
  const safe = sanitizeThemeName(baseName)

  if (customThemes[safe] == null) {
    return safe
  }

  let suffix = 2
  while (customThemes[`${safe}-${suffix}`] != null) {
    suffix += 1
  }

  return `${safe}-${suffix}`
}

function getOptionBounds<T>(options: readonly T[], current: T): { canDecrease: boolean; canIncrease: boolean } {
  const index = options.indexOf(current)
  return {
    canDecrease: index > 0,
    canIncrease: index >= 0 && index < options.length - 1,
  }
}

function stepValue<T>(options: readonly T[], current: T, direction: -1 | 1): T {
  const index = options.indexOf(current)
  const nextIndex = Math.max(0, Math.min(index + direction, options.length - 1))
  return options[nextIndex] ?? current
}

function destroyApp(): void {
  if (appDestroyed || renderer.isDestroyed) {
    return
  }

  appDestroyed = true
  clearPromptAnimation()

  if (timerInterval != null) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  renderer.destroy()
}

async function loadPersistedState(): Promise<PersistedState | null> {
  const file = Bun.file(STORAGE_PATH)

  if (!(await file.exists())) {
    return null
  }

  try {
    const parsed = JSON.parse(await file.text()) as Partial<PersistedState>

    if (!isAppSettings(parsed.settings) || !isThemePaletteRecord(parsed.customThemes)) {
      return null
    }

    return {
      settings: parsed.settings,
      customThemes: parsed.customThemes,
    }
  } catch {
    return null
  }
}

async function persistState(): Promise<void> {
  const payload: PersistedState = {
    settings,
    customThemes,
  }

  await Bun.write(STORAGE_PATH, `${JSON.stringify(payload, null, 2)}\n`)
}

function isAppSettings(value: unknown): value is AppSettings {
  if (typeof value !== "object" || value == null) {
    return false
  }

  const candidate = value as Partial<AppSettings>

  return (candidate.mode === "words" || candidate.mode === "time")
    && WORD_COUNT_OPTIONS.includes(candidate.wordCount as WordCountOption)
    && TIME_OPTIONS.includes(candidate.timeSeconds as TimeOption)
    && typeof candidate.theme === "string"
}

function isThemePalette(value: unknown): value is ThemePalette {
  if (typeof value !== "object" || value == null) {
    return false
  }

  const candidate = value as Partial<ThemePalette>
  return THEME_FIELDS.every((field) => typeof candidate[field] === "string")
}

function isThemePaletteRecord(value: unknown): value is Record<string, ThemePalette> {
  if (typeof value !== "object" || value == null) {
    return false
  }

  return Object.values(value).every((entry) => isThemePalette(entry))
}
