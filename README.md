# TypeTUI

TypeTUI is a MonkeyType-inspired typing test built as a terminal UI with `@opentui/core` and TypeScript.

## Features

- Centered typing layout with a large progress or countdown display
- Word-count mode with `30`, `50`, or `100` word tests
- Timed mode with `15`, `30`, or `60` second tests
- Per-character feedback:
  - upcoming text in muted color
  - correct text in a brighter completed color
  - mistakes in red
- Current-line focused prompt with next-line preview
- WPM, accuracy, and elapsed time after each test
- Built-in themes plus custom theme creation and saving
- Theme import/export through JSON files

## Install

```bash
bun install
```

To use it like a command from anywhere, install it globally from the project folder:

```bash
npm link
```

That gives you these commands:

- `typetui`
- `tt`

After you make code changes, reinstall the local CLI with:

```bash
bun run install:local
```

Because `npm link` creates a global symlink to your working folder, most code changes are picked up immediately. You usually only need to run it again if you change package metadata or the CLI bin setup.

## Run

```bash
bun run index.ts
```

Or, after global install:

```bash
typetui
```

## Main Controls

- Type normally to begin the test
- `Backspace` removes the last typed character
- `Enter` restarts after a finished test
- `Ctrl+R` resets the current test
- `Ctrl+S` opens settings
- `Esc` quits the app

## Settings

Inside settings you can change:

- test mode: `words` or `time`
- word count: `30`, `50`, `100`
- time limit: `15`, `30`, `60`
- active theme

Settings controls:

- `Up` / `Down` or `k` / `j` to move between fields
- `Left` / `Right` or `h` / `l` to change a setting value
- `Enter` to open the theme editor or apply settings
- `Ctrl+S` to apply settings
- `Esc` to close settings

## Theme Creator

Open settings, move to `Theme Edit`, and press `Enter`.

Theme creator controls:

- `j` / `k` to move between theme fields
- `Enter` to edit a field's hex color
- `n` to rename the current theme draft
- `s` to save a new named theme
- `w` to overwrite the current saved theme
- `d` to delete the current custom theme
- `e` to export the current theme to JSON
- `i` to import themes from disk
- `Esc` to go back

Hex input accepts:

- `#RGB`
- `#RRGGBB`

## Theme Import / Export

- Exported theme files are written to `~/.config/typetui/themes/`
- App settings and saved custom themes are stored in `~/.config/typetui/settings.json`
- This config directory is intended to also hold future custom test data

## Development

Type-check the project with:

```bash
bunx tsc --noEmit
```

Helpful scripts:

```bash
bun run dev
bun run check
bun run install:local
```
