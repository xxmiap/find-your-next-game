"""Normalize the pinned Eskuel / Fronkon v44 USD release for the dashboard."""
import hashlib
import json
import shutil
import sqlite3
import tempfile
import zipfile
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
PACKAGE = DATA / 'raw' / 'steam-games.eskueldb'
DB_SHA = '634a0f64d224a6474034b739b5daeafbf97847c01e612350ad78523feacf57d9'
DB_MEMBER = 'data/steam-games.sqlite'
SOURCE_URL = 'https://eskuel.de/en/databases/steam-games/'
DOWNLOAD_URL = 'https://eskuel.de/res/databases/steam-games/localizations/en/main/1.0.0/steam-games.eskueldb'
UPSTREAM_URL = 'https://www.kaggle.com/datasets/fronkongames/steam-games-dataset/versions/44'


def digest(path):
    with path.open('rb') as stream:
        h = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
        return h.hexdigest()


def vocabulary(db, entity, link, key):
    names = [r[0] for r in db.execute(f'SELECT name FROM {entity} ORDER BY name')]
    indices = {name: i for i, name in enumerate(names)}
    by_game = defaultdict(list)
    for app, name in db.execute(f'SELECT app_id,name FROM {link} JOIN {entity} USING({key}) ORDER BY app_id,position,{key}'):
        by_game[app].append(indices[name])
    return names, by_game


def normalize(db):
    tags, game_tags = vocabulary(db, 'tags', 'game_tags', 'tag_id')
    genres, game_genres = vocabulary(db, 'genres', 'game_genres', 'genre_id')
    rows = []
    audit = Counter()
    years = Counter()
    names = Counter()
    sql = '''SELECT app_id,name,release_date,release_date_source,price_usd,supports_windows,supports_mac,supports_linux,
                    positive_reviews,negative_reviews,estimated_owners_min,estimated_owners_max
             FROM games ORDER BY app_id'''
    for app, name, date, raw_date, price, win, mac, linux, pos, neg, lo, hi in db.execute(sql):
        cents = Decimal(str(price)) * 100
        if not cents.is_finite() or cents != cents.to_integral_value() or cents < 0:
            raise ValueError(f'Invalid USD price for app {app}: {price}')
        # Upstream's zero can mean is_free OR missing price_overview. This
        # release does not retain is_free, so never certify a zero as free.
        verified_cents = int(cents) if cents else None
        tag_ids = game_tags.get(app, [])
        flags = win | (mac << 1) | (linux << 2)
        rows.append([app, name, date or raw_date or '', tag_ids, game_genres.get(app, []), flags, verified_cents, pos, neg, lo, hi])
        names[name] += 1
        years[date[:4] if date else 'unparsed'] += 1
        audit.update({'games': 1, 'usd_prices': bool(cents), 'unverified_zero': not cents, 'no_tags': not tag_ids,
                      'zero_reviews': pos + neg == 0, 'no_platform': not flags})
    return {'tags': tags, 'genres': genres, 'rows': rows}, {**audit, 'repeated_names': sum(n > 1 for n in names.values()), 'release_years': dict(years)}


def prepare():
    with tempfile.TemporaryDirectory(prefix='fng-us-') as temp, zipfile.ZipFile(PACKAGE) as archive:
        provenance = json.loads(archive.read('PROVENANCE.json'))
        if provenance['properties']['priceCurrency'] != 'USD' or provenance['input']['version'] != '44':
            raise ValueError('Expected the pinned USD source (Fronkon Games v44)')
        sqlite_path = Path(temp) / 'source.sqlite'
        with archive.open(DB_MEMBER) as src, sqlite_path.open('wb') as dst:
            shutil.copyfileobj(src, dst)
        if digest(sqlite_path) != DB_SHA:
            raise ValueError('Source database does not match the pinned release')
        with sqlite3.connect(sqlite_path.as_uri() + '?mode=ro', uri=True) as db:
            catalog, counts = normalize(db)
        if counts['games'] != provenance['statistics']['outputRecords']:
            raise ValueError('Unexpected row count')
        for src, dest in [('PROVENANCE.json','SOURCE_PROVENANCE.json'),('LICENSES/FRONKON-GAMES-MIT.txt','SOURCE_LICENSE.txt'),('NOTICES/STEAM-DATA-NOTICE.txt','SOURCE_NOTICE.txt')]:
            (DATA / dest).write_bytes(archive.read(src))
    meta = dict(counts, currency='USD', market='US', snapshot=provenance['input']['snapshotDate'], source=SOURCE_URL,
                upstream=UPSTREAM_URL, download=DOWNLOAD_URL, source_db_sha256=DB_SHA,
                source_package_sha256=digest(PACKAGE), distinct_tags=len(catalog['tags']),
                price_basis='Recorded storefront price; may include discounts',
                zero_policy='Source zeros have no retained free indicator and are treated as unverified, not free',
                source_rows_excluded=0)
    (DATA/'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    (DATA/'audit.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps({k:meta[k] for k in ('snapshot','games','usd_prices','unverified_zero','no_tags','zero_reviews','distinct_tags')}, indent=2))


if __name__ == '__main__':
    prepare()
