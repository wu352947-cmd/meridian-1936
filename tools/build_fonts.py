#!/usr/bin/env python3
"""Subset OFL 1.1 fonts into compact WOFF2 bundles for Meridian 1936."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONTS_OUT = ROOT / "public" / "assets" / "fonts"
FONTS_OUT.mkdir(parents=True, exist_ok=True)

EXTRA_UI_CHARS = (
    "子午线碎裂大陆参谋地图政治版图地形地貌外交阵营工业资源"
    "缩放重置关于开源致谢关闭确认取消省区海峡海域陆地沿海内陆"
    "首都都市平原森林丘陵高山沼泽荒漠公海战区邻接胜利点工业值"
    "德意志国大不列颠法兰西共和国苏维埃联盟意大利王国波兰共和国"
    "但泽自由市西班牙共和国捷克斯洛伐克奥地利联邦匈牙利王国"
    "罗马尼亚王国南斯拉夫王国保加利亚王国希腊王国土耳其共和国"
    "芬兰共和国瑞典王国挪威王国丹麦王国冰岛王国荷兰王国比利时王国"
    "卢森堡大公国瑞士联邦葡萄牙共和国爱尔兰自由邦立陶宛共和国"
    "拉脱维亚共和国爱沙尼亚共和国阿尔巴尼亚王国伊拉克王国伊朗帝国"
    "沙特阿拉伯域外边疆同盟国轴心国共产国际中立国阵营主权国家"
    "威权集权议会立宪议会共和苏维埃联邦法团威权军政威权国联托管"
    "永久中立保守法团摄政王国君主立宪君主威权民族共和民族威权"
    "视野开阔适于机械化纵深机动林密隐蔽利于步兵依托阵地防御"
    "起伏缓坡制高点易守难攻险峻天堑重装备通行严重受阻泥泞水网"
    "装甲推进与补给吃紧工业铁路枢纽巷战消耗极高干旱戈壁补给线"
    "极度依赖沿岸公路海上交通舰队巡弋战区"
    "公有领域开源许可协议版权署名声明数据来源字体图形着色器"
    "本软件严格遵守中性历史制图规范严禁违禁符号"
    "左键点击选中省份国家滚轮拖拽平移模式快捷键当前层级详查战术战役洲际"
    "甲乙丙丁戊己庚辛壬癸东西南北中上下左右前后内外高低大小"
    "〇一二三四五六七八九十百千万亿年月日起止时分秒"
    "·—…「」『』【】（）《》，。、：；！？％＋－×÷°′″★☆✦⚡▲▼➔•◈▶❚▴▾"
)


def collect_charset() -> str:
    chars = set(EXTRA_UI_CHARS)
    # Full printable ASCII + Latin-1/Extended-A for European diacritics
    for cp in range(0x20, 0x7F):
        chars.add(chr(cp))
    for cp in range(0xC0, 0x180):
        chars.add(chr(cp))
    # Pull every character from compiled europe_1936.json and src/
    meta_file = ROOT / "public" / "data" / "europe_1936" / "europe_1936.json"
    if meta_file.exists():
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        for p in meta.get("provinces", []):
            for k in ("nameZh", "nameEn", "cityZh", "cityEn"):
                if p.get(k):
                    chars.update(str(p[k]))
        for c in meta.get("labelCurves", []):
            chars.update(c.get("nameZh", ""))
            chars.update(c.get("nameEn", ""))
    for src_file in (ROOT / "src").rglob("*.ts*"):
        chars.update(src_file.read_text(encoding="utf-8"))
    # Remove control chars
    return "".join(sorted(c for c in chars if ord(c) >= 0x20))


def subset_font(src: Path, dst: Path, text: str, font_number: int | None = None) -> None:
    text_file = ROOT / ".cache" / f"subset_{dst.stem}.txt"
    text_file.parent.mkdir(parents=True, exist_ok=True)
    text_file.write_text(text, encoding="utf-8")
    cmd = [
        sys.executable, "-m", "fontTools.subset", str(src),
        f"--text-file={text_file}",
        "--flavor=woff2",
        "--layout-features=*",
        "--no-hinting",
        "--desubroutinize",
        f"--output-file={dst}",
    ]
    if font_number is not None:
        cmd.append(f"--font-number={font_number}")
    subprocess.run(cmd, check=True)
    print(f"[font] {dst.name}: {dst.stat().st_size / 1024:.1f} KB")


def main() -> None:
    cjk_text = collect_charset()
    latin_text = "".join(chr(cp) for cp in range(0x20, 0x7F)) + "".join(chr(cp) for cp in range(0xC0, 0x180)) + "°′″—–·★"
    mono_text = "".join(chr(cp) for cp in range(0x20, 0x7F)) + "°′″—–·×÷±%"
    print(f"[chars] CJK+Latin charset size = {len(cjk_text)}")

    wenkai_src = ROOT / "data" / "raw" / "fonts" / "LXGWWenKaiGBScreen.ttf"
    if wenkai_src.exists():
        subset_font(wenkai_src, FONTS_OUT / "lxgw-wenkai-subset.woff2", cjk_text)
    else:
        subset_font(Path("/usr/share/fonts/opentype/noto/NotoSerifCJK-SemiBold.ttc"),
                    FONTS_OUT / "lxgw-wenkai-subset.woff2", cjk_text, font_number=2)

    subset_font(
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
        FONTS_OUT / "noto-sans-sc-subset.woff2",
        cjk_text,
        font_number=2,
    )
    subset_font(
        Path("/usr/share/fonts/truetype/sand-box/google/JetBrains Mono/JetBrainsMono-VariableFont_wght.ttf"),
        FONTS_OUT / "jetbrains-mono-subset.woff2",
        mono_text,
    )
    subset_font(
        Path("/usr/share/fonts/truetype/sand-box/google/Cinzel/Cinzel-VariableFont_wght.ttf"),
        FONTS_OUT / "cinzel-subset.woff2",
        latin_text,
    )

    ofl_note = (
        "SIL Open Font License 1.1 (OFL-1.1)\n\n"
        "The WOFF2 font subsets in this directory are derived from:\n"
        "- LXGW WenKai Screen (https://github.com/lxgw/LxgwWenKai-Screen) - SIL OFL 1.1\n"
        "- Noto Sans CJK SC (https://github.com/notofonts/noto-cjk) - SIL OFL 1.1\n"
        "- JetBrains Mono (https://github.com/JetBrains/JetBrainsMono) - SIL OFL 1.1\n"
        "- Cinzel (https://github.com/NDISCOVER/Cinzel) - SIL OFL 1.1\n\n"
        "Full SIL OFL 1.1 text: https://openfontlicense.org/\n"
    )
    (FONTS_OUT / "OFL.txt").write_text(ofl_note, encoding="utf-8")
    print("[done] fonts ready in", FONTS_OUT)


if __name__ == "__main__":
    main()
