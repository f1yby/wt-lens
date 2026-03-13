import json
with open('public/data/stats-meta.json') as f:
    meta = json.load(f)
with open('public/data/vehicles-index.json') as f:
    vehicles = json.load(f)
with open('public/data/aircraft-index.json') as f:
    aircraft = json.load(f)
with open('public/data/ships-index.json') as f:
    ships = json.load(f)

vehicle_ids = {v['id'] for v in vehicles}
aircraft_ids = {a['id'] for a in aircraft}
ship_ids = {s['id'] for s in ships}
meta_ids = set(meta['vehicleIds'])

print(f'Ground: {len(vehicle_ids)}, Aircraft: {len(aircraft_ids)}, Ships: {len(ship_ids)}')
print(f'Meta IDs: {len(meta_ids)}')
print(f'Ground in meta: {len(vehicle_ids & meta_ids)}')
print(f'Aircraft in meta: {len(aircraft_ids & meta_ids)}')
print(f'Ships in meta: {len(ship_ids & meta_ids)}')
combined = vehicle_ids | aircraft_ids | ship_ids
print(f'Combined: {len(combined)}, Meta not in combined: {len(meta_ids - combined)}')
