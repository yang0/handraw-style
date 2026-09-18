---
name: handdraw-style-prompter
description: Turn a 001–267 hand-drawn style number and image theme into bilingual prompts, using model capability data to decide when core traits and a numbered reference image are required.
---

# Hand-drawn Style Prompter

Default to creating prompts only. Do not call an image-generation tool unless the user explicitly asks to generate, render, or preview an image.

## Style activation policy

Use the same capability decision for prompt-only and explicit image-generation requests. Resolve the selected/current model (or model family) against `references/model_capabilities.json`; if no model is specified, use the default capability fallback. The decision uses the indexed author name plus the generated style name and is not based on the author's fame or life status.

- `name_activation=strong`: use only the indexed author name, generated style name, and theme.
- Otherwise, include every available positive core trait with the author/style name and theme.
- If name plus traits is not strongly activated, also require the configured reference asset. For explicit generation, pass it through `referenced_image_paths`. In `pure-image` prompt-only output, write the local asset path and reference-isolation instruction inside both prompts for the user to upload manually. In `graphic-text` prompt-only output, do not place a path, upload instruction, or isolation block inside either copyable prompt; show the resolved reference image to the user outside the prompts instead. Assets live under the installed package root in numbered 200-style buckets: for example, #217 uses `images/individual/201-400/217_grid.webp`.
- If no positive core trait exists, do not invent one; use the author/style name, theme, and reference image when required.
- If the model identifier or its capability entry is unavailable, treat it as `unknown`, include any available positive traits, and require the image as the safe fallback.
- Use `python scripts/resolve_reference.py --model <model> --style <number>` when a deterministic decision check is useful. The script prints JSON and never guesses an unknown model's capability.
- The resolver reports `activation_source` as `name+style`, `name+style+traits`, `name+style+traits+reference-image`, or `name+style+reference-image`, plus filtered `prompt_traits` and the local `reference_path` when required.

- Resolve the style number to its configured reference asset relative to the installed package root. The normal fallback is `images/individual/{bucket}/{number}.webp` (for example, `048` maps to `images/individual/001-200/048.webp`); a matching `{number}_grid.webp` in the same bucket takes priority.
- When a reference image is required, inject the following reference-isolation block into `pure-image` prompt-only output and every actual image-generation prompt. Do not inject it into a `graphic-text` copyable prompt; the actual image-generation prompt still receives it together with the attached asset.

  Chinese: `所附图片仅用于参考画风。只提取参考图的风格特征，例如线条、笔触、媒介、材质、色彩倾向和整体视觉语言；不要使用、复制或延续参考图中的任何主体、人物、动物、服装、道具、动作、姿态、场景、背景、构图、布局、文字或故事。最终画面内容完全以用户提供的主题为准。`

  English: `Use the attached image only as a style reference. Extract only its stylistic qualities, such as linework, brushwork, medium, material texture, color tendencies, and overall visual language. Do not use, copy, or carry over any subject, person, animal, clothing, prop, action, pose, setting, background, composition, layout, text, or story from the reference image. The user's written theme is the sole source for the image content.`

- The user's theme is the sole source for subjects and narrative; the reference image must never override or add content to the theme.
- Include only positive visible traits; filter clauses containing `避免`, `不要`, `不准`, or `禁止` and do not copy the traits field mechanically.
- If the numbered image is missing or cannot be passed, report that limitation and provide the normal text prompts; never invent or substitute a reference image.
- After generation, identify whether the numbered reference image was used. If used, identify its number. Do not imply generation when the user requested prompts only.

## Session initialization

On the first turn in the current Codex task/thread where this Skill is invoked, perform both initialization actions before handling the user's request. This applies to **任何首次请求**, including opening the gallery, browsing the index, requesting prompts, or requesting image generation:

1. If this task has not already displayed the gallery, call `mcp__codex_app__open_in_codex` in a browser tab with `target.type="browser"` and URL `file:///E:/handraw-style/handdraw-style-prompter/gallery/index.html`. Never open `gallery/index.html` as `target.type="file"`, in an editor, or as a file preview.
2. Include the exact standalone status line `当前处于纯图模式，可切换为图文模式。` in the same final reply, even when the request produces no prompt.
3. Continue with the user's request after the browser call; opening the gallery must not block prompt generation or an explicitly requested image-generation follow-up. If the same first reply would also add the pure-image mode note, show this status line only once.
4. Do not repeat the browser call or this first-session status notice on later turns in the same task/thread. Use the conversation context (not a persistent state file) to determine whether initialization already happened.
5. If the browser call is unavailable or fails, provide the same local `file:///E:/handraw-style/handdraw-style-prompter/gallery/index.html` fallback link, then continue normally.

This initialization applies only when this Skill is invoked for the first time in a task/thread; unrelated conversations must not open the gallery.

## Inputs

Require a style number (`001`–`267`) and a theme. Accept optional aspect ratio, subject constraints, text requirements, and a mode. If the number is absent or invalid, ask the user to choose a valid number; do not invent a style. Do not add an aspect ratio when none was supplied.

Users can browse `gallery/index.html` for the numbered contact sheets. The authoritative style content is `../styles_200_reorganized.md`; `references/styles.json` is a generated index and must be refreshed with `python scripts/build_library.py` after the Markdown changes.

## Prompt modes

Default to `pure-image`. Accept `纯图模式` / `图文模式` in conversation and `--mode pure-image|graphic-text` in the CLI.

- `pure-image`: preserve the current prompt workflow. After the normal reply, add the small note `当前处于纯图模式，可切换为图文模式。`.
- `graphic-text`: preserve the user's theme exactly after `主题：` / `Theme:`. Do not expand, paraphrase, interpret, or add scene elements, characters, actions, metaphors, emotional explanations, or theme commentary. Append the following text verbatim to the end of both the Chinese and English prompts. Do not translate, trim, normalize, rewrite, label, or reorder any character in it. The exact final prompt, including this suffix, is sent unchanged to the image AI when generation is requested. When a reference asset is required, display that image outside the copyable prompts; do not expose its local path, upload instruction, or reference-isolation block in either prompt.

  `【如果主题直白包含画面元素那就按主题出图，文案由你来升华，但是不要直接描述画面。 如果主题比较概念化，那么文案和主题尽量保持一致，如果文案较长由你提炼，由你先设计画面隐喻（人类和非人类都行）再出图   。    文字参与构图，图文一体】`

## Output

For a valid request, return these four parts:

1. Selected style: number and generated style name. Include core traits inside the two copyable prompts when the resolved activation policy requires them; do not create a separate core-visual-traits section.
2. Chinese prompt: begin the copyable prompt itself with `风格名称：#{编号} · {generation_name}。`; describe only the user's theme and constraints explicitly provided by the user, and always include the indexed author/style name as a short `参考作者/风格名称` label. When required, append filtered positive traits as `核心风格特征：...`. In `pure-image` mode, append a required reference image's local path and reference-isolation instruction. In `graphic-text` mode, preserve the theme verbatim, append the exact fixed suffix from Prompt modes at the end, and show any required reference image outside the prompt instead. Traits describe rendering style only and must not replace or alter the user's subjects, actions, setting, or story.
3. English prompt: begin the copyable prompt itself with `Style name: #{number} · {generation_name}.`; describe only the same theme and user-provided constraints, and always include the indexed author/style name as `Reference author/style name`. When required, append the same traits as `Core style traits: ...`. In `pure-image` mode, append a required reference image's local path and reference-isolation instruction. In `graphic-text` mode, preserve the theme verbatim, append the exact fixed Chinese suffix at the end, and show any required reference image outside the prompt instead. Do not append generic composition advice, quality claims, negative prompts, or the fixed style anchor.
4. A brief note: the prompt can be pasted into any image AI; generation is controlled by that AI.

Do not invent visual traits, extra style descriptions, generic quality/composition language, or default avoid-list wording. Include each entry's original reference author/style name from the index in both prompts as requested; this is an index label, not a claim about the person or an instruction to imitate them. Never use fame or life status as a proxy for model capability.

In `pure-image` mode, describe only concrete visible content implied by the theme—subjects, actions, objects, environment, and mood when needed. In `graphic-text` mode, use the user's theme verbatim and leave all semantic expansion to the fixed suffix. In both modes, leave composition, layout, visual richness, quality, and rendering decisions to the image AI. Respect a user-specified text requirement but do not invent copy.

## Utilities

- From the installed package root, rebuild the derived index and gallery: `python handdraw-style-prompter/scripts/build_library.py`
- Split contact sheets into numbered single images: `python handdraw-style-prompter/scripts/split_contact_sheets.py`
- Validate all source/index/gallery invariants: `python handdraw-style-prompter/scripts/validate_library.py`
- Produce a deterministic CLI prompt draft: `python handdraw-style-prompter/scripts/prompt_style.py --style 18 --theme "秋天的第一杯奶茶"`
- Resolve image-reference policy: `python handdraw-style-prompter/scripts/resolve_reference.py --model <model> --style 18`

The CLI is a convenience check. For normal conversational use, write natural bilingual prompts rather than echoing its template mechanically.
