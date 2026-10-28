---
name: reel-style
description: Use when the user wants reel-cut visuals to match a brand, website, GitHub project, reels or images, or wants to change the colours, fonts or shapes of a reel-cut style.
---

# reel-style

A reel-cut style is a `style.json` of palette, fonts, shapes and motion. Templates read it, so one style changes the look of every visual. Styles live in `reel-cut/styles/<name>/` under the current folder.

## Make a style

Run in the background, since it takes a minute or two:

```sh
npx -y @jose.legaspi/reel-cut style create <name> --from <reference> [<reference>...]
```

References can be websites, GitHub repos, reel URLs, or image, video or HTML files. Two or three references of the same brand work better than one. The name must be lowercase letters, digits and dashes.

The command gathers screenshots, asks Claude for a style, and draws `sheet.png`, a preview of every template in the style. Open `sheet.png` and look at it before showing the user.

## Use it

```sh
npx -y @jose.legaspi/reel-cut run <video> --style <name>
```

For an existing project, repeat the project's original input and flags, adding `--style <name>`. Only the render reruns. Use `--style default` to go back to the built-in look.

## Layout

A style's `layout` sets how the speaker sits under split visuals (`speaker`: `full` edge to edge, or `card`, a rounded inset card) and whether captions show (`captions`: `none`, or `word`, the word being said, one at a time, with emphasis words in the accent).

## Tweak it

- **A style everywhere:** edit `reel-cut/styles/<name>/style.json`, then run `npx -y @jose.legaspi/reel-cut style sheet <name>` and look at the new sheet. The schema is closed, so the sheet command names any value it rejects.
- **One project only:** put the changed fields under `overrides` in `reel-cut/projects/<project>/style.json`, using the same sections as the style itself, then run `npx -y @jose.legaspi/reel-cut stage render <project>`:
  ```json
  { "version": 1, "base": "acme", "overrides": { "palette": { "accent": "#ff7a00", "onAccent": "#ffffff" } } }
  ```

## Common mistakes

- Picking fonts that aren't on Google Fonts. The command suggests the closest matches.
- Low-contrast palettes. Warnings name the colour pairs that are hard to read; fix them before rendering.
- Running `style create` again to fix one colour. Edit `style.json` instead, because a rerun re-gathers references and asks Claude again.
