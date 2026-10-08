#!/usr/bin/env python3
# /// script
# dependencies = ["fonttools"]
# ///
"""从一个中文字体里抽子集，写成 woff 放进 engine/lib/fonts/。缺字形会静默回退系统字体（换台机器就变样），
所以画面里要用的中文字必须真的在子集里——引擎启动时 U.assertGlyphs 会查角标的字，缺了 console.error，qa 失败。

    uv run scripts/font_subset.py                         # 重建预置的霞鹜文楷子集（扫 engine/ 下全部 .js 里的中文＋内置常用字）
    uv run scripts/font_subset.py --scan <代码工程目录>     # 把另一个工程里用到的中文也并进来
    uv run scripts/font_subset.py --text "皮影戏蓝色时期"   # 追加指定文字
    uv run scripts/font_subset.py --font path/to/XXX.ttf --out <工程>/lib/fonts/XXX-400.woff --text "..."   # 别的字体
    uv run scripts/font_subset.py --gb2312 ...           # 再并进 GB2312 全部 6763 个汉字（解说片换题目不用每次补字；单字重约 1MB）
    uv run scripts/font_subset.py --fix-widths engine/lib/fonts/PuHui-Medium.woff   # 只修字宽为 0 的全角空格（普惠体 Medium/Bold 源字体的 bug）

预置的解说片字体（YouTube 语法示范与新片都用，见 references/09）就是这么做的（开源版的中文黑体换成了思源黑体，--font 指向 Noto Sans SC 按字重实例化后的 ttf；普惠体许可不允许转换后再分发，只能自己本地生成）：
    uv run scripts/font_subset.py --gb2312                                                     # 霞鹜文楷（白板）
    for w in 65-Medium:Medium 85-Bold:Bold 105-Heavy:Heavy 115-Black:Black; do                # 阿里巴巴普惠体 3.0 四个字重
      uv run scripts/font_subset.py --gb2312 --font path/to/AlibabaPuHuiTi-3-${w%%:*}.ttf --out scripts/engine/lib/fonts/PuHui-${w##*:}.woff; done

默认字体：霞鹜文楷 Medium（LXGW WenKai，SIL Open Font License 1.1，可商用、可再分发、可嵌入），
没有源文件就从 https://github.com/lxgw/LxgwWenKai/releases 下 LXGWWenKai-Medium.ttf，用 --font 指过去。
新字体加进 engine/lib/fonts.js 才会注册（family 名 = 文件名去扩展名）。
"""
import argparse, re, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
ENGINE = HERE / 'engine'
# 预置字：数字、标点、年代/朝代、常见风格与画种用字。子集保持小（几十 KB），用到新字再跑一次本脚本。
BASE = ('0123456789０１２３４５６７８９ ，。、：；！？「」『』《》（）·—…～'
        '年代世纪公元前后约初中晚期朝唐宋元明清汉魏晋隋周秦商夏民国现当今古'
        '水墨写意工笔山水花鸟人物画法风格派主义时期艺术家作品壁窟敦煌莫高佛飞天供养'
        '浮世绘木版印刷版画剪纸皮影戏偶灯影窗花年画书法篆隶楷行草印章钤朱文白'
        '油画素描水彩粉笔丙烯蛋彩湿壁金箔马赛克镶嵌玻璃彩窗手抄本插图漫画动画卡通'
        '古典文艺复兴巴洛克洛可可新浪漫写实印象后点彩野兽表现立体未来达达超现实抽象波普极简构成包豪斯装饰'
        '蓝色玫瑰红黄绿青紫黑灰橙金银光影明暗烛夜日月星云雨雪风天海河湖林竹梅兰菊松'
        '少女猫茶杯桌椅窗门墙地屋室灯花瓶书纸笔'
        '八大山人齐白石克里姆特蒙克呐喊草间弥生波点伦勃朗吉卜力宫崎骏新海诚毕加索修拉莫奈睡莲马蒂斯哈林达利霍珀凯斯杰克柯比'
        '蒸汽波像素光追橡皮管一二三四五六七八九十百千万')


# 解说片常用的全角标点与符号
PUNCT = '，。、：；！？「」『』《》（）【】·—–…～“”‘’％＋－×÷→←↑↓▲▼≈±°¥€①②③④⑤⑥⑦⑧⑨⑩✓'


def gb2312_l1():
    """GB2312 全部 6763 个汉字（一级 3755 常用字＋二级 3008 次常用字，如「渲」「浏」）"""
    out = set()
    for hi in range(0xB0, 0xF8):
        for lo in range(0xA1, 0xFF):
            try: out.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError: pass
    return out


def cjk(text):
    return set(ch for ch in text if ord(ch) > 0x2E7F)


STR = re.compile(r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`")


def scan(d):
    """只收 JS 字符串字面量里的中文（注释里的中文不会画到画面上，算进来子集会胖 20 倍）"""
    out = set()
    for f in Path(d).rglob('*.js'):
        try: src = f.read_text(encoding='utf-8')
        except Exception: continue
        src = '\n'.join(re.sub(r'^\s*//.*$', '', l) for l in src.splitlines())
        for m in STR.finditer(src): out |= cjk(m.group(0))
    return out


def fix_blank_widths(font):
    """全角空格 U+3000 在阿里巴巴普惠体 3.0 的 Medium／Bold 源字体里字宽是 0（Heavy／Black 正常 984/990），
    「月收盘价，美元　纵轴未从 0 开始」会粘成一串。把它设成和「一」同宽。返回修了几个。"""
    cmap, hm, n = font.getBestCmap(), font['hmtx'], 0
    ref = cmap.get(0x4E00)
    for cp in (0x3000,):
        g = cmap.get(cp)
        if g and ref and hm[g][0] == 0:
            hm[g] = (hm[ref][0], 0); n += 1
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--font', default=str(Path.home() / 'Library/Fonts/LXGWWenKai-Medium.ttf'))
    ap.add_argument('--out', default=str(ENGINE / 'lib/fonts/LXGWWenKai-500.woff'))
    ap.add_argument('--scan', action='append', default=[], help='额外扫描的目录（可多次）')
    ap.add_argument('--text', default='', help='额外要的字')
    ap.add_argument('--no-default-scan', action='store_true', help='不扫 skill 自己的 engine/')
    ap.add_argument('--gb2312', action='store_true', help='并进 GB2312 全部汉字（6763 个）')
    ap.add_argument('--fix-widths', nargs='+', metavar='WOFF', help='不抽子集，只修已有字体文件里字宽为 0 的全角空格')
    a = ap.parse_args()
    if a.fix_widths:
        for f in a.fix_widths:
            ft = TTFont(f); n = fix_blank_widths(ft); ft.flavor = 'woff'
            if n: ft.save(f)
            print(f'{f}：修了 {n} 个字宽')
        return
    if not Path(a.font).exists(): sys.exit(f'找不到字体 {a.font}（见脚本说明的下载地址）')
    chars = set(BASE) | set(a.text)
    if not a.no_default_scan: chars |= scan(ENGINE)
    for d in a.scan: chars |= scan(d)
    chars |= set(chr(c) for c in range(0x20, 0x7F))           # ASCII 全带上（年份、英文副标题）
    if a.gb2312: chars |= gb2312_l1() | set(PUNCT)
    font = TTFont(a.font)
    cmap = font.getBestCmap()
    miss = sorted(ch for ch in chars if ord(ch) not in cmap and not ch.isspace())
    opts = subset.Options(); opts.flavor = 'woff'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    sub = subset.Subsetter(opts); sub.populate(text=''.join(sorted(chars))); sub.subset(font)
    if fix_blank_widths(font): print('源字体全角空格字宽为 0，已设成和「一」同宽')
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    font.flavor = 'woff'; font.save(a.out)
    print(f'{a.out}  {len(chars)} 字  {Path(a.out).stat().st_size // 1024} KB' + (f'\n源字体里也没有：{"".join(miss)}' if miss else ''))


if __name__ == '__main__':
    main()
