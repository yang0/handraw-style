---
name: handdraw-style-prompter
description: Turn a 001–267 hand-drawn style number and image theme into bilingual prompts, using model capability data to decide when core traits and a numbered reference image are required.
---

# Hand-drawn Style Prompter

This is the install entrypoint for the complete hand-drawn style package.
The package root contains the `images/` gallery and numbered reference assets;
the operational contract is [handdraw-style-prompter/SKILL.md](handdraw-style-prompter/SKILL.md).

Before handling a request, read that Skill file completely. Resolve every
gallery and reference-image path from this installed package root. Install this
repository at path `.` so the `images/` directory and the nested Skill are
kept together.
