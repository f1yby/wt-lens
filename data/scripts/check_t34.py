#!/usr/bin/env python3
import json
f='data/datamine/aces.vromfs.bin_u/gamedata/weapons/groundmodels_weapons/76mm_f34_user_cannon.blkx'
with open(f) as fh: d=json.load(fh)
for k in ['76mm_ussr_AP_1941', '76mm_ussr_AP_1942']:
    if k in d:
        b=d[k]['bullet']
        print(f'=== {k} ({b["bulletType"]}) ===')
        print(f'  mass={b["mass"]} speed={b["speed"]} caliber={b["caliber"]}')
        print(f'  explosiveMass={b.get("explosiveMass")} explosiveType={b.get("explosiveType")}')
        dmg=b.get('damage',{})
        kin=dmg.get('kinetic',{}) if isinstance(dmg,dict) else {}
        for kk in sorted(kin.keys()):
            print(f'  kinetic.{kk} = {kin[kk]}')
