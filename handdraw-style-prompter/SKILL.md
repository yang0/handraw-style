---
name: handdraw-style-prompter
description: Turn a 001–216 hand-drawn style number and image theme into bilingual prompts, or generate an image with the matching numbered image used strictly as a style reference when the user explicitly requests generation.
---

# Hand-drawn Style Prompter

Default to creating prompts only. Do not call an image-generation tool unless the user explicitly asks to generate, render, or preview an image.

## Explicit image-generation mode

When the user explicitly requests image generation, use the same theme prompt and pass the matching single reference image through the image-generation tool's `referenced_image_paths` parameter:

- Resolve the style number to `E:\handraw-style\images\individual\{number}.png` (for example, `048` maps to `E:\handraw-style\images\individual\048.png`).
- Tell the image model that this input is a style reference only. Extract only broad visual language such as line quality, brush or medium feel, and color tendency when useful.
- Explicitly ignore the reference image's subjects, people, animals, objects, setting, actions, composition, layout, text, and story elements. The user's written theme is the sole source for image content.
- If the numbered image is missing or cannot be passed, report that limitation and provide the normal text prompts; never invent or substitute a reference image.
- After generation, identify which numbered reference image was used. Do not imply generation when the user requested prompts only.

## Session initialization

On the first turn in the current Codex task/thread where this Skill is invoked, initialize the visual index before handling the user's request:

1. If this task has not already displayed the gallery, call `mcp__codex_app__open_in_codex` with `target: { type: "browser", url: "file:///E:/handraw-style/handdraw-style-prompter/gallery/index.html" }` so the rendered gallery opens in the in-app browser.
2. Continue with the user's request after the browser call; opening the gallery must not block prompt generation or an explicitly requested image-generation follow-up.
3. Do not repeat the browser call on later turns in the same task/thread. Use the conversation context (not a persistent state file) to determine whether initialization already happened.
4. If the browser call is unavailable or fails, provide this fallback link: [打开手绘风格编号画廊](file:///E:/handraw-style/handdraw-style-prompter/gallery/index.html), then continue normally.

This initialization applies only when this Skill is invoked for the first time in a task/thread; unrelated conversations must not open the gallery.

## Inputs

Require a style number (`001`–`216`) and a theme. Accept optional aspect ratio, subject constraints, and text requirements. If the number is absent or invalid, ask the user to choose a valid number; do not invent a style. Do not add an aspect ratio when none was supplied.

Users can browse `gallery/index.html` for the numbered contact sheets. The authoritative style content is `../styles_200_reorganized.md`; `references/styles.json` is a generated index and must be refreshed with `python scripts/build_library.py` after the Markdown changes.

## Output

For a valid request, return these four parts:

1. Selected style: number and generated style name. Do not output a core-visual-traits field by default.
2. Chinese prompt: begin the copyable prompt itself with `风格名称：#{编号} · {generation_name}。`; describe only the user's theme and constraints explicitly provided by the user, and always include the indexed author/style name as a short `参考作者/风格名称` label. Do not append core traits, the fixed style anchor, extra style adjectives, generic composition advice, quality claims, or negative prompts.
3. English prompt: begin the copyable prompt itself with `Style name: #{number} · {generation_name}.`; describe only the same theme and user-provided constraints, and always include the indexed author/style name as `Reference author/style name`. Do not append visual-trait prose, generic composition advice, quality claims, negative prompts, or the fixed style anchor.
4. A brief note: the prompt can be pasted into any image AI; generation is controlled by that AI.

Do not invent visual traits, extra style descriptions, generic quality/composition language, or default avoid-list wording. Include each entry's original reference author/style name from the index in both prompts as requested; this is an index label, not a claim about the person or an instruction to imitate them. Never guess a person's status.

Describe only concrete visible content implied by the theme—subjects, actions, objects, environment, and mood when needed. Leave composition, layout, visual richness, quality, and rendering decisions to the image AI. Respect a user-specified text requirement but do not invent copy.

## Utilities

- Rebuild the derived index and gallery: `python scripts/build_library.py`
- Split contact sheets into numbered single images: `python scripts/split_contact_sheets.py`
- Validate all source/index/gallery invariants: `python scripts/validate_library.py`
- Produce a deterministic CLI prompt draft: `python scripts/prompt_style.py --style 18 --theme "秋天的第一杯奶茶"`

The CLI is a convenience check. For normal conversational use, write natural bilingual prompts rather than echoing its template mechanically.
