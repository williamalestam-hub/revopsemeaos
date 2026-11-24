"""Writes store/ — one JSON file per dashboard document (dash/meta, dash/params, datasets/*, files/*)
ready to be written to the Dashboard artifact's store. Prints each document's size and fails when one is over the
store's limit of 256 KB a document.
    python3 dashboard/build_store.py [out_dir]    out_dir: write there instead of dashboard/store (the tests do)"""
import json, os, datetime, shutil, re, sys
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else 'store'
os.chdir(os.path.dirname(os.path.abspath(__file__)))  # paths below are relative to dashboard/, whatever the cwd
LIMIT = 262144  # bytes of JSON a stored document may hold
AT = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
EDIT = {"via": "claude", "at": AT}
for col in ('dash', 'datasets', 'files'): shutil.rmtree(os.path.join(OUT, col), ignore_errors=True)
def put(col, doc, data):
    os.makedirs(f'{OUT}/{col}', exist_ok=True)
    json.dump(data, open(f'{OUT}/{col}/{doc}.json', 'w', encoding='utf-8'), ensure_ascii=False)
def page(text):
    """index.html as it is stored: every line without its leading whitespace. The source keeps its indentation, and the
    stored page reads the same in a browser: indentation between tags is not shown. That only holds while the file has
    no <pre>, <textarea>, inline <script> or <style>, and no attribute value running over a line end, so those stop the
    build instead of being changed quietly."""
    if re.search(r'<(pre|textarea|style)\b|<script(?![^>]*\bsrc=)', text, re.I):
        sys.exit('index.html holds a <pre>, <textarea>, <style> or inline <script>: its lines can no longer be stripped safely')
    odd = [i + 1 for i, line in enumerate(text.split('\n')) if line.count('"') % 2]
    if odd:
        sys.exit(f'index.html line {odd[0]}: an attribute value seems to run over the line end (odd number of "): keep each on one line')
    return re.sub(r'(?m)^[ \t]+', '', text)
put('dash', 'meta', {"title": "EMEA RevOps OS"})
put('dash', 'params', {"region": "All", "pq": "this", "crm": "opps", "onlyMissing": False, "orphanReason": "", "person": "", "grWindow": 30, "gr_since": "2026-10-04", "gr_until": "2026-11-03", "grOwner": "all", "checkArea": "All", "mgr": "", "grGroup": "meeting", "gr11": False, "dealOwnerId": "005Pn00000N96c1IAB", "dealFlag": "", "renewFlag": "", "grDue": False, "grShowDone": False, "ooWho": "", "ooRoot": "", "cal_from": "2026-11-03T00:00:00", "cal_to": "2026-11-17T00:00:00", "ldReady": "", "ldProb": "", "actRole": "", "actLook": False, "actLeft": False, "cvSeg": "all", "cvRt": "nb", "cvClean": False})
for k, v in json.load(open('datasets.json', encoding='utf-8')).items():
    put('datasets', k, {**v, "edit": EDIT})
for f in ['index.html', 'os.css', 'os-cockpit.css', 'os-core.js', 'os-calcs.js', 'os-calcs-leads.js', 'os-calcs-act.js', 'os-calcs-conv.js', 'os-draw.js',
          'os-cockpit-model.js', 'os-cockpit-scene.js', 'os-cockpit.js']:
    text = open(f, encoding='utf-8').read()
    put('files', f, {"text": page(text) if f == 'index.html' else text, "edit": EDIT})
over = []
for col in ('dash', 'datasets', 'files'):
    for f in sorted(os.listdir(f'{OUT}/{col}')):
        path = f'{OUT}/{col}/{f}'; size = os.path.getsize(path)
        print(path, size, *([] if size <= LIMIT else [f'OVER the {LIMIT} byte limit by {size - LIMIT}']))
        if size > LIMIT: over.append(path)
if over:
    sys.exit(f'{len(over)} document(s) over {LIMIT} bytes: ' + ', '.join(over))
