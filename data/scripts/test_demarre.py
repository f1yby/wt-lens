"""Test whether Wiki formula uses raw explosiveMass or TNT equivalent."""
import math, json

# Load explosive equivalents
with open('data/datamine/aces.vromfs.bin_u/gamedata/damage_model/explosive.blkx') as f:
    expl_data = json.load(f)
equivs = {}
for name, info in expl_data.get('explosiveTypes', {}).items():
    if isinstance(info, dict) and 'brisanceEquivalent' in info:
        equivs[name] = info['brisanceEquivalent']

def calc_pen(cal, mass, speed, expl, is_apcbc):
    kfbr = 1900
    kf = 1.0 if is_apcbc else 0.9
    tnt = (expl / mass) * 100
    if tnt < 0.65: knap = 1
    elif tnt < 1.6: knap = 1 + (tnt - 0.65) * (0.93 - 1) / (1.6 - 0.65)
    elif tnt < 2: knap = 0.93 + (tnt - 1.6) * (0.9 - 0.93) / (2 - 1.6)
    elif tnt < 3: knap = 0.9 + (tnt - 2) * (0.85 - 0.9) / (3 - 2)
    elif tnt < 4: knap = 0.85 + (tnt - 3) * (0.75 - 0.85) / (4 - 3)
    else: knap = 0.75
    return (speed**1.43 * mass**0.71) / (kfbr**1.43 * (cal/100)**1.07) * 100 * knap * kf

tests = [
    # (name, cal, mass, speed, expl_mass, expl_type, is_apcbc, wiki_pen)
    ("Tiger I PzGr 39 APCBC", 88, 9.5, 810, 0.168, "fp10_np10", True, 165),
    ("T-34 BR-350A APHEBC", 76.2, 6.5, 655, 0.065, "a_ix_2", False, 87),
    ("Sherman M62 APCBC", 76.2, 7.0, 792, 0.0637, "tnt", True, 149),
    ("IS-2 BR-471 APHE", 122, 25.0, 795, 0.156, "a_ix_2", False, None),
]

for name, cal, mass, speed, expl, etype, apcbc, wiki in tests:
    brisance = equivs.get(etype, 1.0)
    tnt_eq = expl * brisance
    p_raw = calc_pen(cal, mass, speed, expl, apcbc)
    p_tnt = calc_pen(cal, mass, speed, tnt_eq, apcbc)
    wiki_str = f"wiki={wiki}" if wiki else "wiki=?"
    print(f"{name}: brisance({etype})={brisance:.3f}")
    print(f"  raw expl({expl:.4f}): {p_raw:.2f}mm")
    print(f"  tnt equiv({tnt_eq:.4f}): {p_tnt:.2f}mm  {wiki_str}")
    print()
