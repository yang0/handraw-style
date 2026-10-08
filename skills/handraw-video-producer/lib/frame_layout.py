"""Frame selection shared by episode creation and whiteboard preparation."""
from math import gcd


def resolve_frame(aspect=None, width=None, height=None, fps=30, default_aspect="9:16"):
    if (width is None) != (height is None):
        raise ValueError("--width 与 --height 必须成对指定")
    ratio = None
    if aspect:
        try:
            a, b = map(int, aspect.split(":"))
            if a <= 0 or b <= 0:
                raise ValueError
            ratio = (a, b)
        except (ValueError, AttributeError):
            raise ValueError("画幅比例须为正整数，例如16:9或9:16") from None
    if width is None:
        a, b = ratio or tuple(map(int, default_aspect.split(":")))
        factor = 1920 / max(a, b)
        width, height = max(2, round(a*factor/2)*2), max(2, round(b*factor/2)*2)
    if any(type(n) is not int or n <= 0 or n % 2 for n in (width, height)):
        raise ValueError("H.264画布宽高须为正偶数")
    if ratio and width * ratio[1] != height * ratio[0]:
        raise ValueError("显式尺寸与--aspect不一致；只给尺寸时会自动推导比例")
    if type(fps) is not int or fps <= 0:
        raise ValueError("fps须为正整数")
    divisor = gcd(width, height)
    return {"width":width,"height":height,"fps":fps,
            "aspect_ratio":f"{width//divisor}:{height//divisor}",
            "orientation":"landscape" if width>height else "portrait" if height>width else "square"}
