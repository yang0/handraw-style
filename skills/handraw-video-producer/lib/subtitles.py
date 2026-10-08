"""Narration subtitle policy; graphic text and speech timing are independent."""
from pathlib import Path

SUBTITLE_MODES = ('burn-in', 'sidecar', 'none')


def resolve_subtitle_mode(meta):
    # Compatibility fallback, not an editorial recommendation for new work.
    mode = meta.get('subtitle_mode', 'burn-in')
    if mode not in SUBTITLE_MODES:
        raise ValueError('subtitle_mode须为burn-in、sidecar或none；先明确交付策略')
    return mode


def export_subtitles(ep_dir, meta, timing):
    """Return active SRT path or None. Never delete an archived subtitle file."""
    if resolve_subtitle_mode(meta) == 'none':
        return None
    from tts_engine import generate_srt
    segments = timing.get('segments', [])
    if not segments:
        raise ValueError('字幕交付需要实际语音边界，不从画面文字猜时间')
    path = Path(ep_dir) / 'outputs' / 'subtitles.srt'
    path.parent.mkdir(exist_ok=True)
    path.write_text(generate_srt(segments), encoding='utf-8')
    return 'outputs/subtitles.srt'
