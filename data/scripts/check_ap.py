"""Quick validation: check how many AP shells now get penetration from de Marre."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fetch_utils import (
    parse_ammunition_data, load_weapon_data, WEAPONS_PATH,
    DEMARRE_AP_TYPES, DEMARRE_APCR_TYPES,
)
import json

# Scan all weapon files
ap_with_pen = 0
ap_without_pen = 0
apcr_with_pen = 0
apcr_without_pen = 0
examples = []

for wf in sorted(WEAPONS_PATH.glob("*.blkx")):
    try:
        with open(wf) as f:
            wd = json.load(f)
    except Exception:
        continue

    # Get weapon caliber
    wcal = 0
    wi = wd.get('Weapon')
    if isinstance(wi, dict):
        c = wi.get('caliber', 0)
        wcal = c * 1000 if c else 0

    for key, val in wd.items():
        if not isinstance(val, dict) or 'bullet' not in val:
            continue
        b = val['bullet']
        if not isinstance(b, dict):
            continue
        bt = b.get('bulletType', '')
        if bt not in (DEMARRE_AP_TYPES | DEMARRE_APCR_TYPES):
            continue

        ammo = parse_ammunition_data(b, wcal)
        if not ammo:
            continue

        pen = ammo.get('penetration0m', 0)
        if bt in DEMARRE_APCR_TYPES:
            if pen and pen > 0:
                apcr_with_pen += 1
            else:
                apcr_without_pen += 1
                examples.append(f"APCR MISSING: {wf.name} / {key} mass={b.get('mass')} cal={b.get('caliber')} dmgCal={b.get('damageCaliber')} dmgMass={b.get('damageMass')}")
        else:
            if pen and pen > 0:
                ap_with_pen += 1
            else:
                ap_without_pen += 1
                examples.append(f"AP MISSING: {wf.name} / {key} type={bt} mass={b.get('mass')} speed={b.get('speed')} cal={b.get('caliber')}")

        # Show some examples
        if pen and pen > 0 and len([e for e in examples if 'EXAMPLE' in e]) < 8:
            examples.append(f"EXAMPLE: {key} ({bt}) → {pen}mm [cal={ammo['caliber']}mm mass={ammo['mass']}kg v={ammo['muzzleVelocity']}m/s]")

print(f"AP/APC/APBC/APCBC/APHE/APHEBC with penetration: {ap_with_pen}")
print(f"AP/APC/APBC/APCBC/APHE/APHEBC WITHOUT penetration: {ap_without_pen}")
print(f"APCR with penetration: {apcr_with_pen}")
print(f"APCR WITHOUT penetration: {apcr_without_pen}")
print(f"\nTotal with pen: {ap_with_pen + apcr_with_pen}")
print(f"Total without pen: {ap_without_pen + apcr_without_pen}")
print()
for e in examples[:20]:
    print(f"  {e}")
