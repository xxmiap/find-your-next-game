"""Compute independent SQL reference counts for the USD build from the raw source."""
from pathlib import Path
import json,sqlite3,shutil,tempfile,zipfile
ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temp, zipfile.ZipFile(ROOT/'data/raw/steam-games.eskueldb') as z:
    file=Path(temp)/'reference.sqlite'
    with z.open('data/steam-games.sqlite') as inp, file.open('wb') as out: shutil.copyfileobj(inp,out)
    with sqlite3.connect(file.as_uri()+'?mode=ro',uri=True) as db:
        tags=['Rogue-like','Indie','Platformer']
        sql='''WITH matches AS (
           SELECT g.app_id,g.price_usd,g.supports_windows,g.supports_mac,g.supports_linux,COUNT(DISTINCT t.name) AS matches,
                  MAX(t.name = 'Platformer') AS platformer
           FROM games g JOIN game_tags gt USING(app_id) JOIN tags t USING(tag_id)
           WHERE g.app_id != 248820 AND t.name IN ('Rogue-like','Indie','Platformer') GROUP BY g.app_id
        ) SELECT COUNT(*) FROM matches WHERE ((matches=3) OR (? AND matches=2 AND platformer=0))
          AND (? IS NULL OR (price_usd>0 AND price_usd<=?)) AND '''
        cases=[]
        for os,where in {'mac':'supports_mac','windows':'supports_windows','linux':'supports_linux','any':'1'}.items():
            for cap in [500,1000,1500,2000,3000,6000,None]:
                for relaxed in [False,True]:
                    dollars=None if cap is None else cap/100
                    n=db.execute(sql+where,(relaxed,dollars,dollars)).fetchone()[0]
                    cases.append(dict(os=os,cap=cap,relaxed=relaxed,count=n))
(ROOT/'tests/reference.json').write_text(json.dumps(cases,indent=2)+'\n')
print('Generated',len(cases),'SQL reference cases')
