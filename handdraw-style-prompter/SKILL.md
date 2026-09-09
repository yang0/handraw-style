---
name: handdraw-style-prompter
description: Turn a 001–261 hand-drawn style number and image theme into bilingual prompts, or generate an image with a model-capability-aware decision about whether the matching numbered image is needed as a style reference.
---

# Hand-drawn Style Prompter

Default to creating prompts only. Do not call an image-generation tool unless the user explicitly asks to generate, render, or preview an image.

## Explicit image-generation mode

When the user explicitly requests image generation, first resolve the current image model (or model family) against `references/model_capabilities.json` or the equivalent runtime capability metadata. The decision uses the complete text that will be sent to the model: the indexed author name plus the generated style name. It is not based on the author's fame or life status.

- `name_activation=strong`: first choice. Send only the indexed author name plus generated style name and theme; do not add core traits or pass a reference image.
- If name activation is not strong but `traits_activation=strong` and the style has core traits, second choice. Add only positive, concrete visual traits to the author-name + style-name prompt and do not pass a reference image.
- If neither author-name + style-name nor author-name + style-name + traits is strong, last choice. Pass the configured reference asset through the image-generation tool's `referenced_image_paths` parameter. Assets live in numbered 200-style buckets: for example, #217 uses `E:\handraw-style\images\individual\201-400\217_grid.jpg`.
- If the model identifier or its capability entry is unavailable, treat it as `unknown` and pass the image as the safe fallback.
- Use `python scripts/resolve_reference.py --model <model> --style <number>` when a deterministic decision check is useful. The script prints JSON and never guesses an unknown model's capability.
- The resolver reports `activation_source` as `name+style`, `name+style+traits`, or `reference-image`, plus the filtered `prompt_traits` when traits are used.

- Resolve the style number to its configured reference asset. The normal fallback is `E:\handraw-style\images\individual\{bucket}\{number}.png` (for example, `048` maps to `E:\handraw-style\images\individual\001-200\048.png`); a matching `{number}_grid.jpg` in the same bucket takes priority.
- When an image is passed, inject the following reference-isolation block into the actual image-generation prompt. It is required for every reference-image generation and is not added to ordinary prompt-only output:

  Chinese: `所附图片仅用于参考画风。只提取参考图的风格特征，例如线条、笔触、媒介、材质、色彩倾向和整体视觉语言；不要使用、复制或延续参考图中的任何主体、人物、动物、服装、道具、动作、姿态、场景、背景、构图、布局、文字或故事。最终画面内容完全以用户提供的主题为准。`

  English: `Use the attached image only as a style reference. Extract only its stylistic qualities, such as linework, brushwork, medium, material texture, color tendencies, and overall visual language. Do not use, copy, or carry over any subject, person, animal, clothing, prop, action, pose, setting, background, composition, layout, text, or story from the reference image. The user's written theme is the sole source for the image content.`

- The user's theme is the sole source for subjects and narrative; the reference image must never override or add content to the theme.
- When core traits are used instead of an image, include only positive visible traits; filter clauses containing `避免`, `不要`, or `不准` and do not copy the traits field mechanically.
- If the numbered image is missing or cannot be passed, report that limitation and provide the normal text prompts; never invent or substitute a reference image.
- After generation, identify whether the numbered reference image was used. If used, identify its number. Do not imply generation when the user requested prompts only.

## Session initialization

On the first turn in the current Codex task/thread where this Skill is invoked, initialize the visual index before handling the user's request:

1. If this task has not already displayed the gallery, call `mcp__codex_app__open_in_codex` with `target: { type: "browser", url: "file:///E:/handraw-style/handdraw-style-prompter/gallery/index.html" }` so the rendered gallery opens in the in-app browser.
2. Continue with the user's request after the browser call; opening the gallery must not block prompt generation or an explicitly requested image-generation follow-up.
3. Do not repeat the browser call on later turns in the same task/thread. Use the conversation context (not a persistent state file) to determine whether initialization already happened.
4. If the browser call is unavailable or fails, provide this fallback link: [打开手绘风格编号画廊](file:///E:/handraw-style/handdraw-style-prompter/gallery/index.html), then continue normally.

This initialization applies only when this Skill is invoked for the first time in a task/thread; unrelated conversations must not open the gallery.

## Inputs

Require a style number (`001`–`261`) and a theme. Accept optional aspect ratio, subject constraints, and text requirements. If the number is absent or invalid, ask the user to choose a valid number; do not invent a style. Do not add an aspect ratio when none was supplied.

Users can browse `gallery/index.html` for the numbered contact sheets. The authoritative style content is `../styles_200_reorganized.md`; `references/styles.json` is a generated index and must be refreshed with `python scripts/build_library.py` after the Markdown changes.

## Output

For a valid request, return these four parts:

1. Selected style: number and generated style name. Do not output a core-visual-traits field by default for ordinary prompt-only requests.
2. Chinese prompt: begin the copyable prompt itself with `风格名称：#{编号} · {generation_name}。`; describe only the user's theme and constraints explicitly provided by the user, and always include the indexed author/style name as a short `参考作者/风格名称` label. Do not append core traits, the fixed style anchor, extra style adjectives, generic composition advice, quality claims, or negative prompts.
3. English prompt: begin the copyable prompt itself with `Style name: #{number} · {generation_name}.`; describe only the same theme and user-provided constraints, and always include the indexed author/style name as `Reference author/style name`. Do not append visual-trait prose, generic composition advice, quality claims, negative prompts, or the fixed style anchor.
4. A brief note: the prompt can be pasted into any image AI; generation is controlled by that AI.

Do not invent visual traits, extra style descriptions, generic quality/composition language, or default avoid-list wording. Include each entry's original reference author/style name from the index in both prompts as requested; this is an index label, not a claim about the person or an instruction to imitate them. Never use fame or life status as a proxy for model capability.

Describe only concrete visible content implied by the theme—subjects, actions, objects, environment, and mood when needed. Leave composition, layout, visual richness, quality, and rendering decisions to the image AI. Respect a user-specified text requirement but do not invent copy.

## Utilities

- Rebuild the derived index and gallery: `python scripts/build_library.py`
- Split contact sheets into numbered single images: `python scripts/split_contact_sheets.py`
- Validate all source/index/gallery invariants: `python scripts/validate_library.py`
- Produce a deterministic CLI prompt draft: `python scripts/prompt_style.py --style 18 --theme "秋天的第一杯奶茶"`
- Resolve image-reference policy: `python scripts/resolve_reference.py --model <model> --style 18`

The CLI is a convenience check. For normal conversational use, write natural bilingual prompts rather than echoing its template mechanically.
