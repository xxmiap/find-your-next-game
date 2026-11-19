// Runs in an isolated headless Chrome context. It never controls an open user browser.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/Users/xiaoxiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1370},acceptDownloads:true});
    page.setDefaultTimeout(8000);
    const errors=[],requests=[],passed=[];
    page.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});page.on('request',r=>requests.push(r.url()));
    const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS',name)};
    const countIn=async id=>Number((await page.locator(id).innerText()).replace(/,/g,'').match(/\d+/)?.[0]);
    const readStatus=()=>page.locator('#status').innerText();
    const editSearch=async()=>{if(await page.locator('#setup').isHidden())await page.locator('#toggle-setup').click()};
    const start=Date.now();await page.goto(pathToFileURL(path.join(root,'dist/index.html')).href);await page.locator('#candidate-list tbody tr').first().waitFor();const loadMs=Date.now()-start;
    await check('Complete catalog, USD price caps, and three offline charts',async()=>{
      assert.equal(await page.evaluate(()=>STEAM_SNAPSHOT.catalog.rows.length),125854);
      assert.equal(await page.evaluate(()=>d3.version),'7.9.0');
      assert.match(await readStatus(),/^57 candidates/);assert.equal(await page.locator('#budget').inputValue(),'1500');
      assert.equal(await page.locator('.chart-card:visible').count(),3);
      assert.match(await page.locator('#candidate-list tbody td:nth-child(3)').first().innerText(),/^\$/);
      assert.ok(!/£|\bGBP\b/.test(await page.locator('body').innerText()));
    });
    await check('Compact search keeps analysis visible and labels review-volume leaders',async()=>{
      assert.ok(await page.locator('#setup').isHidden());
      assert.match(await page.locator('#search-summary').innerText(),/Rogue-like.*required/s);
      await page.setViewportSize({width:1512,height:982});
      await page.waitForTimeout(160);
      const chart=await page.locator('#panel-b').boundingBox();
      assert.ok(chart.y<491,JSON.stringify(chart));
      const annotated=await page.locator('#view-b [data-label-game]').evaluateAll(nodes=>nodes.map(n=>n.dataset.labelGame));
      const expected=await page.evaluate(()=>candidates().filter(hasReviewRate).sort((a,b)=>b.reviews-a.reviews||a.id.localeCompare(b.id)).slice(0,3).map(g=>g.id));
      assert.deepEqual(annotated,expected);
      assert.match(await page.locator('#view-b .review-label-note').innerText(),/most-reviewed candidates/);
      const renderedBands=await page.locator('#view-c [data-band]').evaluateAll(nodes=>nodes.map(n=>+n.dataset.band));
      const populated=await page.evaluate(()=>derived().priceGroups.flatMap((group,i)=>group.length?[i]:[]));
      assert.deepEqual(renderedBands,populated);
      assert.match(await page.locator('#view-c').innerText(),/empty bands are hidden/);
      await editSearch();
      await page.locator('[data-seed="248820"]').click();
      assert.ok(await page.locator('#setup').isHidden());
      assert.match(await page.locator('#search-summary').innerText(),/Action Roguelike/);
      await page.locator('#reset').click();
      await editSearch();
      await page.locator('#manual-tags').click();
      assert.ok(await page.locator('#setup').isVisible());
      assert.equal(await page.locator('#view-c [data-band]').count(),0);
      assert.match(await page.locator('#view-c').innerText(),/No games match/);
      await page.locator('#reset').click();
      await page.setViewportSize({width:1440,height:1370});
    });
    await check('Optional Platformer and shared-tag selection',async()=>{
      await page.locator('#relax').click();assert.match(await page.locator('#comparison').innerText(),/57 before → 581 now · \+524 NEW/);
      await page.locator('#view-a [data-select-row="3"]').click();assert.match(await readStatus(),/^581 candidates · 524 selected/);
      assert.equal(await countIn('#list-count'),524);
      const selected=await page.locator('#view-c .selected-count').evaluateAll(ns=>ns.reduce((a,b)=>a+Number(b.textContent.replace(/,/g,'')),0));assert.equal(selected,524);
    });
    await check('Clear, previous filters, and pinned baseline',async()=>{
      await page.locator('#clear').click();assert.equal(await countIn('#list-count'),581);
      await page.locator('#undo').click();assert.equal(await countIn('#list-count'),57);
      await page.locator('#pin').click();await editSearch();await page.locator('#budget').selectOption('3000');assert.match(await page.locator('#comparison').innerText(),/^57 before/);
      await page.locator('#reset').click();
    });
    await check('Dollar-band selection updates tag counts and list',async()=>{
      await page.locator('#view-c [data-band]:enabled').first().click();const n=await countIn('#list-count');assert.ok(n>0&&n<=57);
      assert.equal(await countIn('#view-a .selected-count'),n);await page.locator('#clear').click();
    });
    await check('Review brush and zero-review exclusion',async()=>{
      const svg=page.locator('#view-b svg');await svg.scrollIntoViewIfNeeded();const b=await svg.boundingBox();
      await page.mouse.move(b.x+49,b.y+31);await page.mouse.down();await page.mouse.move(b.x+b.width-15,b.y+b.height-51,{steps:10});await page.mouse.up();
      const n=await page.evaluate(()=>candidates().filter(g=>g.reviews>0).length);assert.equal(await countIn('#list-count'),n);assert.ok(await page.locator('#view-b .brush .selection').isVisible());
    });
    await check('Live review hover shows U.S. dollars',async()=>{
      await page.locator('#clear').click();const svg=page.locator('#view-b svg');const b=await svg.boundingBox();
      const point=await page.evaluate(()=>{
        const svg=document.querySelector('#view-b svg'),g=candidates().find(g=>g.reviews>0),w=+svg.getAttribute('width'),h=+svg.getAttribute('height');
        return [54+Math.log10(g.reviews)/maxPower*(w-74),h-56+(92-h)*g.rate/100];
      });
      await page.mouse.move(b.x+point[0],b.y+point[1]);assert.ok(await page.locator('#tooltip').isVisible());assert.match(await page.locator('#tooltip').innerText(),/\$.*reviews/s);
    });
    await check('Details, compare, export and snapshot metadata',async()=>{
      await page.locator('#candidate-list .name-btn').first().click();assert.match(await page.locator('#modal-body').innerText(),/Snapshot price \(USD\)/);
      assert.match(await page.locator('#modal-body a').getAttribute('href'),/\?cc=us$/);await page.locator('#detail-save').click();await page.locator('#close-modal').click();await page.locator('#clear').click();
      await page.locator('#candidate-list .star').nth(1).click();await page.locator('#compare-shortlist').click();assert.equal(await page.locator('#modal-body tbody tr').count(),2);await page.locator('#close-modal').click();
      const promise=page.waitForEvent('download');await page.locator('#export-shortlist').click();const download=await promise;
      const csv=fs.readFileSync(await download.path(),'utf8');assert.match(csv,/price_usd/);assert.match(csv,/2026-08-25/);assert.ok(!/GBP|£/i.test(csv));
    });
    await check('Game details distinguish three exact matches from a partial match',async()=>{
      await page.locator('#reset').click();await page.locator('#sort').selectOption('name');
      await page.locator('#candidate-list [data-details="603530"]').click();
      assert.match(await page.locator('#modal-title').innerText(),/A Robot Named Fight!/);
      assert.deepEqual(await page.locator('#modal .tag-match').allTextContents(),['Rogue-like','Indie','Platformer']);
      assert.match(await page.locator('#modal .detail-tag-match').innerText(),/3 of 3 matched/);
      assert.equal(await page.locator('#modal .detail-tag-missing').count(),0);
      assert.ok((await page.locator('#modal .detail-tag-other .tag').count())>3);
      fs.mkdirSync(path.join(root,'tests/output'),{recursive:true});
      await page.locator('#modal').screenshot({path:path.join(root,'tests/output/us-matched-tags.png')});
      await page.locator('#close-modal').click();await page.locator('#relax').click();
      await page.locator('#view-a [data-select-row="3"]').click();await page.locator('#candidate-list .name-btn').first().click();
      assert.deepEqual(await page.locator('#modal .tag-match').allTextContents(),['Rogue-like','Indie']);
      assert.match(await page.locator('#modal .detail-tag-match').innerText(),/2 of 3 matched/);
      assert.match(await page.locator('#modal .detail-tag-missing').innerText(),/Not recorded: Platformer/);
      await page.locator('#close-modal').click();await page.locator('#sort').selectOption('reviews');await page.locator('#reset').click();
    });
    await check('Real search and source tags refresh',async()=>{
      await editSearch();await page.locator('#seed-search').fill('Hollow Knight');await page.locator('[data-seed="367520"]').click();
      assert.match(await page.locator('#tags').innerText(),/Metroidvania/);assert.ok(await page.evaluate(()=>candidates().every(g=>g.id!=='367520')));
    });
    await check('Starting-game tag bank exposes all recorded tags and lets users swap a suggestion',async()=>{
      await page.locator('#reset').click();await editSearch();await page.locator('[data-seed="248820"]').click();await editSearch();
      assert.equal(await page.locator('[data-seed-tag]').count(),20);
      assert.match(await page.locator('#tag-choice-count').innerText(),/Suggested tags · 3\/3/);
      assert.match(await readStatus(),/^206 candidates/);
      assert.equal(await page.locator('[data-seed-tag="Pixel Graphics"]').getAttribute('aria-disabled'),'true');
      await page.locator('[data-seed-tag="Indie"]').click();
      await page.locator('[data-seed-tag="Pixel Graphics"]').click();
      assert.match(await page.locator('#tags').innerText(),/Pixel Graphics/);
      assert.equal(await page.locator('#tags [data-remove]').count(),3);
      assert.equal(await page.locator('[data-seed-tag="Pixel Graphics"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('[data-seed-tag="Indie"]').getAttribute('aria-pressed'),'false');
    });
    await check('Density preserves candidates; larger chart hover and cell selection link to the list',async()=>{
      await page.locator('#reset').click();await page.locator('#relax').click();
      const compact=await page.locator('#view-b svg').boundingBox();
      await page.locator('#view-b [data-review-mode="density"]').click();
      assert.match(await readStatus(),/^581 candidates/);
      assert.match(await page.locator('#view-b .legend').innerText(),/Games per cell/);
      assert.match(await page.locator('[data-expand="b"]').innerText(),/^Expand\s*↗$/);
      await page.locator('[data-expand="b"]').click();
      const expanded=page.locator('#expanded-chart svg'), box=await expanded.boundingBox();
      assert.ok(box.width>compact.width*1.8&&box.height>compact.height*1.4,JSON.stringify({compact,box}));
      assert.equal(await page.locator('#expanded-chart [data-review-mode="density"]').getAttribute('aria-pressed'),'true');
      const cell=await page.evaluate(()=>{
        const svg=document.querySelector('#expanded-chart svg');
        const x=d3.scaleLog().domain([1,10**maxPower]).range([54,+svg.getAttribute('width')-20]);
        const y=d3.scaleLinear().domain([0,100]).range([+svg.getAttribute('height')-56,36]);
        const plotted=candidates().filter(hasReviewRate),{cells}=reviewGrid(plotted,x,y);
        if(cells.reduce((sum,c)=>sum+c.games.length,0)!==580)throw Error('Grid omitted or duplicated records');
        const c=cells.reduce((best,c)=>!best||c.games.length>best.games.length?c:best,null);
        return {x:(c.x0+c.x1)/2,y:(c.y0+c.y1)/2,count:c.games.length};
      });
      await page.mouse.move(box.x+cell.x,box.y+cell.y);
      assert.match(await page.locator('#modal #tooltip').innerText(),new RegExp('^'+cell.count+' games in this cell'));
      await page.mouse.click(box.x+cell.x,box.y+cell.y);
      assert.equal(await countIn('#list-count'),cell.count);
      assert.match(await readStatus(),new RegExp('581 candidates · '+cell.count+' selected'));
      fs.mkdirSync(path.join(root,'tests/output'),{recursive:true});
      const selectedBox=await expanded.boundingBox();
      await page.mouse.move(selectedBox.x+cell.x,selectedBox.y+cell.y);
      assert.match(await page.locator('#modal #tooltip').innerText(),new RegExp(cell.count+' selected'));
      await page.locator('#modal').screenshot({path:path.join(root,'tests/output/us-density-expanded.png')});
      await page.locator('#expanded-chart [data-review-mode="points"]').click();
      assert.match(await expanded.getAttribute('aria-label'),/scatterplot/);
      const point=await page.evaluate(()=>{
        const svg=document.querySelector('#expanded-chart svg');
        const g=candidates().filter(g=>selected(g)&&hasReviewRate(g)).sort((a,b)=>b.reviews-a.reviews)[0];
        const x=d3.scaleLog().domain([1,10**maxPower]).range([54,+svg.getAttribute('width')-20]);
        const y=d3.scaleLinear().domain([0,100]).range([+svg.getAttribute('height')-56,36]);
        return {name:g.name,x:x(g.reviews),y:y(g.rate)};
      });
      const pointsBox=await expanded.boundingBox();
      await page.mouse.move(pointsBox.x+point.x,pointsBox.y+point.y);
      const tooltip=page.locator('#modal:modal #tooltip');
      assert.ok(await tooltip.isVisible());
      const preview=await tooltip.innerText();
      assert.ok(preview.startsWith(point.name+'\n'),preview);
      assert.match(preview,/\$.*reviews/s);
      await page.locator('#modal').screenshot({path:path.join(root,'tests/output/us-points-expanded.png')});
      await page.keyboard.press('Escape');
    });
    await check('Unverified prices are excluded under a dollar cap',async()=>{
      await page.locator('#reset').click();await page.locator('#relax').click();
      assert.ok(await page.evaluate(()=>candidates().every(g=>g.price!==null&&g.price<=1500)));
      await editSearch();await page.locator('#budget').selectOption('any');assert.ok(await page.evaluate(()=>candidates().some(g=>g.price===null)));
      assert.equal(await page.locator('#view-c [data-band="7"]').isEnabled(),true);await page.locator('#view-c [data-band="7"]').click();
      assert.match(await page.locator('#candidate-list tbody td:nth-child(3)').first().innerText(),/^Unverified$/);
    });
    await check('Expanded budget control updates the same filters',async()=>{
      await page.locator('[data-expand="c"]').click();await page.locator('#expanded-chart [data-inline-budget]').selectOption('2000');await page.keyboard.press('Escape');assert.equal(await page.locator('#budget').inputValue(),'2000');
    });
    fs.mkdirSync(path.join(root,'tests/output'),{recursive:true});
    await page.locator('#reset').click();await page.locator('#relax').click();await page.locator('#view-a [data-select-row="3"]').click();
    await page.setViewportSize({width:1512,height:1510});await page.waitForTimeout(180);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:path.join(root,'tests/output/us-dashboard.png')});
    await check('Responsive layout and USD source documentation',async()=>{
      for(const width of [390,320]){
        await page.setViewportSize({width,height:900});
        for(const tab of ['sketch','channels','data']){await page.locator('#tab-'+tab).click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} ${tab}`)}
        assert.match(await page.locator('#data').innerText(),/Aug 25, 2026/);
      }
      await page.setViewportSize({width:390,height:900});await page.locator('#tab-sketch').click();await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:path.join(root,'tests/output/us-mobile.png')});
    });
    await check('No runtime errors or automatic network calls',async()=>{assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith('file:')))});
    fs.writeFileSync(path.join(root,'tests/output/results.json'),JSON.stringify({passed,errors,loadMs},null,2));
    console.log(`Verified ${passed.length} browser checks`);
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
