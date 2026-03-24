from pathlib import Path
import re
from collections import defaultdict, OrderedDict

path = Path('nagvis2/changelog.txt')
if not path.exists():
    raise SystemExit(f'Input file not found: {path}')

lines = [l.strip() for l in path.read_text(encoding='utf-16').splitlines() if l.strip()]

entries = []
for l in lines:
    parts = l.split(' ', 2)
    if len(parts) < 3:
        continue
    sha, date, msg = parts[0], parts[1], parts[2]
    entries.append({'sha': sha, 'date': date, 'msg': msg})


def categorize(msg):
    m = msg.lower()
    if m.startswith('merge') or 'merge' in m:
        return 'Merge'
    if re.search(r'\bfix(es|ed)?\b', m) or 'bug' in m:
        return 'Bugfix'
    if re.search(r'\b(doc|readme|docs|documentation)\b', m):
        return 'Docs'
    if re.search(r'\b(add|feature|feat|implement)\b', m):
        return 'Feature'
    if re.search(r'\b(test|tests?)\b', m):
        return 'Tests'
    if re.search(r'\b(task|todo|todo-liste|todo list)\b', m):
        return 'Task'
    return 'Other'

for e in entries:
    e['category'] = categorize(e['msg'])

by_date = OrderedDict()
for e in entries:
    by_date.setdefault(e['date'], []).append(e)

out = []
out.append('# Changelog (automatisch erstellt)')
out.append('')
out.append('Diese Datei wurde aus dem Git-Verlauf erstellt (Commits für `nagvis2/`).')
out.append('')
for date, items in by_date.items():
    out.append(f'## {date}')
    cats = defaultdict(list)
    for e in items:
        cats[e['category']].append(e)
    for cat in ['Feature','Bugfix','Docs','Tests','Task','Merge','Other']:
        if cat in cats:
            out.append(f'### {cat}')
            for e in cats[cat]:
                out.append(f'- `{e["sha"]}` {e["msg"]}')
            out.append('')

out_path = Path('nagvis2/changelog.md')
out_path.write_text('\n'.join(out), encoding='utf-8')
print('Created', out_path)
