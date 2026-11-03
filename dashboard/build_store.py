"""Writes store/ — one JSON file per dashboard document (dash/meta, dash/params, datasets/*, files/*)
ready to be written to the Dashboard artifact's store."""
import json, os, datetime, shutil
AT = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
EDIT = {"via": "claude", "at": AT}
shutil.rmtree('store', ignore_errors=True)
def put(col, doc, data):
    os.makedirs(f'store/{col}', exist_ok=True)
    json.dump(data, open(f'store/{col}/{doc}.json', 'w'), ensure_ascii=False)
put('dash', 'meta', {"title": "EMEA RevOps OS"})
put('dash', 'params', {"region": "All", "pq": "this", "crm": "opps", "onlyMissing": False, "orphanReason": "", "person": "", "grWindow": 30, "gr_since": "2026-10-04", "gr_until": "2026-11-03", "grOwner": "all", "checkArea": "All", "mgr": "", "grGroup": "meeting", "gr11": False, "dealOwnerId": "005Pn00000N96c1IAB", "dealFlag": "", "renewFlag": "", "grDue": False})
for k, v in json.load(open('datasets.json')).items():
    put('datasets', k, {**v, "edit": EDIT})
for f in ['index.html', 'os-core.js', 'os-calcs.js', 'os-draw.js']:
    put('files', f, {"text": open(f).read(), "edit": EDIT})
for root, _, fs in os.walk('store'):
    for f in fs: print(os.path.join(root, f), os.path.getsize(os.path.join(root, f)))
