"""Build a single offline HTML file; --refresh normalizes the pinned raw archive."""
import argparse
import json
import re
from pathlib import Path
from prepare_data import prepare

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--refresh', action='store_true', help='rebuild the compact catalog from data/raw')
args = parser.parse_args()
if args.refresh:
    prepare()

src = ROOT / 'src'
data = ROOT / 'data'
meta = json.loads((data / 'audit.json').read_text())
if meta['currency'] != 'USD' or meta['market'] != 'US':
    raise ValueError('This dashboard requires a U.S. dollar catalog')
# Never let a game title close the inline script.
blob = '{"catalog":'+(data / 'catalog.json').read_text()+',"meta":'+json.dumps(meta,separators=(',',':'))+'}'
js = 'window.STEAM_SNAPSHOT='+blob.replace('<','\\u003c')+';'
(data / 'catalog.js').write_text(js)
html = (src / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="styles.css">','<style>\n'+(src/'styles.css').read_text()+'\n</style>')
for key, code in [('vendor/d3.v7.min.js',(src/'vendor/d3.v7.min.js').read_text()),('../data/catalog.js',js),('core.js',(src/'core.js').read_text()),('app.js',(src/'app.js').read_text())]:
    html,n = re.subn(r'<script src="'+re.escape(key)+r'"></script>',lambda _: '<script>\n'+code+'\n</script>',html)
    if n != 1:
        raise ValueError(f'Expected exactly one source marker for {key}')
notices = '\n\n'.join(p.read_text() for p in (src/'vendor/D3-LICENSE.txt',data/'SOURCE_LICENSE.txt',data/'SOURCE_NOTICE.txt'))
html = html.replace('</head>','<!--\n'+notices.replace('--','—')+'\n-->\n</head>')
output = ROOT / 'dist' / 'index.html'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(html)
print(f'Built {output} ({output.stat().st_size:,} bytes)')
