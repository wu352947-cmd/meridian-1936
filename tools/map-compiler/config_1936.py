"""Projection, canvas constants, and 1936 European country configs."""
from pathlib import Path
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "public" / "data" / "europe_1936"

# Canvas dimensions (4:3 exact square pixels in LAEA Europe)
WIDTH = 4096
HEIGHT = 3072
RELIEF_W = 2048
RELIEF_H = 1536

# LAEA centered at (10E, 52N)
PROJ_LAEA = "+proj=laea +lat_0=52 +lon_0=10 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
X_MIN = -2_300_000.0
X_MAX = 3_700_000.0   # 6000 km
Y_MIN = -2_230_000.0
Y_MAX = 2_270_000.0   # 4500 km

TO_LAEA = Transformer.from_crs("EPSG:4326", PROJ_LAEA, always_xy=True)
TO_LONLAT = Transformer.from_crs(PROJ_LAEA, "EPSG:4326", always_xy=True)


def lonlat_to_px(lon: float, lat: float) -> tuple[float, float]:
    x, y = TO_LAEA.transform(lon, lat)
    px = (x - X_MIN) / (X_MAX - X_MIN) * WIDTH
    py = (Y_MAX - y) / (Y_MAX - Y_MIN) * HEIGHT
    return (px, py)


def meters_to_px(x: float, y: float) -> tuple[float, float]:
    px = (x - X_MIN) / (X_MAX - X_MIN) * WIDTH
    py = (Y_MAX - y) / (Y_MAX - Y_MIN) * HEIGHT
    return (px, py)


def px_to_lonlat(px: float, py: float) -> tuple[float, float]:
    x = X_MIN + (px / WIDTH) * (X_MAX - X_MIN)
    y = Y_MAX - (py / HEIGHT) * (Y_MAX - Y_MIN)
    return TO_LONLAT.transform(x, y)


# Modern Natural Earth ADM0_A3 -> default 1936 sovereign TAG
ADM0_TO_1936: dict[str, str] = {
    "DEU": "GER",
    "FRA": "FRA", "MCO": "FRA", "AND": "FRA",
    "GBR": "GBR", "IMN": "GBR", "GGY": "GBR", "JEY": "GBR",
    "GIB": "GBR", "MLT": "GBR", "CYP": "GBR", "CYN": "GBR",
    "CNM": "GBR", "WSB": "GBR", "ESB": "GBR",
    "EGY": "GBR", "ISR": "GBR", "PSX": "GBR", "JOR": "GBR",
    "IRL": "IRE",
    "ITA": "ITA", "SMR": "ITA", "VAT": "ITA", "LBY": "ITA",
    "POL": "POL",
    "ESP": "SPR",
    "PRT": "POR",
    "BEL": "BEL",
    "NLD": "HOL",
    "LUX": "LUX",
    "CHE": "SWI", "LIE": "SWI",
    "AUT": "AUS",
    "CZE": "CZE", "SVK": "CZE",
    "HUN": "HUN",
    "ROU": "ROM", "MDA": "ROM",
    "SRB": "YUG", "HRV": "YUG", "BIH": "YUG", "SVN": "YUG",
    "MNE": "YUG", "MKD": "YUG", "KOS": "YUG",
    "BGR": "BUL",
    "ALB": "ALB",
    "GRC": "GRE",
    "TUR": "TUR",
    "NOR": "NOR",
    "SWE": "SWE",
    "FIN": "FIN", "ALD": "FIN",
    "DNK": "DEN", "FRO": "DEN",
    "ISL": "ISL",
    "EST": "EST",
    "LVA": "LAT",
    "LTU": "LIT",
    "RUS": "SOV", "BLR": "SOV", "UKR": "SOV",
    "GEO": "SOV", "ARM": "SOV", "AZE": "SOV", "KAZ": "SOV",
    "DZA": "FRA", "TUN": "FRA", "MAR": "FRA", "SYR": "FRA", "LBN": "FRA",
    "IRQ": "IRQ", "IRN": "IRN", "SAU": "SAU",
    "KWT": "GBR", "GRL": "EDG", "SAH": "EDG", "MRT": "EDG",
    "TKM": "SOV", "UZB": "SOV",
}

# Target land province counts per 1936 TAG (sum ~ 615-635)
TARGET_PROVINCES: dict[str, int] = {
    "SOV": 114,
    "GER": 66,
    "FRA": 64,
    "ITA": 46,
    "GBR": 42,
    "POL": 38,
    "DNZ": 1,
    "SPR": 34,
    "ROM": 24,
    "YUG": 24,
    "TUR": 24,
    "FIN": 20,
    "SWE": 20,
    "NOR": 16,
    "CZE": 16,
    "HUN": 14,
    "GRE": 14,
    "AUS": 10,
    "BUL": 10,
    "BEL": 8,
    "HOL": 8,
    "POR": 8,
    "DEN": 7,
    "SWI": 6,
    "IRE": 5,
    "LIT": 5,
    "LAT": 5,
    "EST": 4,
    "ISL": 4,
    "ALB": 3,
    "LUX": 1,
    "IRQ": 4,
    "IRN": 5,
    "SAU": 3,
    "EDG": 2,
}

COUNTRY_NAMES_ZH: dict[str, tuple[str, str]] = {
    "GER": ("德意志", "Germany"),
    "GBR": ("大不列颠", "United Kingdom"),
    "FRA": ("法兰西", "France"),
    "SOV": ("苏维埃联盟", "Soviet Union"),
    "ITA": ("意大利", "Italy"),
    "POL": ("波兰", "Poland"),
    "DNZ": ("但泽", "Danzig"),
    "SPR": ("西班牙", "Spain"),
    "CZE": ("捷克斯洛伐克", "Czechoslovakia"),
    "AUS": ("奥地利", "Austria"),
    "HUN": ("匈牙利", "Hungary"),
    "ROM": ("罗马尼亚", "Romania"),
    "YUG": ("南斯拉夫", "Yugoslavia"),
    "BUL": ("保加利亚", "Bulgaria"),
    "GRE": ("希腊", "Greece"),
    "TUR": ("土耳其", "Turkey"),
    "FIN": ("芬兰", "Finland"),
    "SWE": ("瑞典", "Sweden"),
    "NOR": ("挪威", "Norway"),
    "DEN": ("丹麦", "Denmark"),
    "ISL": ("冰岛", "Iceland"),
    "HOL": ("荷兰", "Netherlands"),
    "BEL": ("比利时", "Belgium"),
    "LUX": ("卢森堡", "Luxembourg"),
    "SWI": ("瑞士", "Switzerland"),
    "POR": ("葡萄牙", "Portugal"),
    "IRE": ("爱尔兰", "Ireland"),
    "LIT": ("立陶宛", "Lithuania"),
    "LAT": ("拉脱维亚", "Latvia"),
    "EST": ("爱沙尼亚", "Estonia"),
    "ALB": ("阿尔巴尼亚", "Albania"),
    "IRQ": ("伊拉克", "Iraq"),
    "IRN": ("伊朗", "Iran"),
    "SAU": ("沙特", "Saudi Arabia"),
    "EDG": ("域外", "Frontier"),
}
