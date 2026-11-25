/* Find Your Next Game · U.S. edition. AI assistance: Codex; original design consultation: Claude. */
'use strict';
const {catalog,meta}=window.STEAM_SNAPSHOT;
const {caps,labels,money,capText,priceBand,inBudget}=GameCore;
const games=GameCore.unpack(catalog);
const byId=new Map(games.map(g=>[g.id,g]));
const tagIndex=GameCore.indexTags(games);
const tagNames=[...catalog.tags].sort((a,b)=>a.localeCompare(b,'en-US'));
const maxPower=Math.max(1,Math.ceil(Math.log10(d3.max(games,g=>g.reviews)||10)));
const demo={seed:'248820',tags:['Rogue-like','Indie','Platformer'],budget:1500,os:'mac'};
const defaultState=()=>({...demo,tags:[...demo.tags],rows:[7],tagOrigin:'Demo preset'});
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=n=>n.toLocaleString('en-US');
const rateText=rate=>rate==null?'No reviews':`${rate.toFixed(1)}%`;
const hasReviewRate=g=>g.reviews>0&&g.rate!==null;
const platformName={mac:'macOS',windows:'Windows',linux:'Linux',any:'Any platform'};
const ownerLabels=['0–50k','50k–200k','200k–1M','1M–5M','5M+'];
const SNAPSHOT=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(meta.snapshot+'T00:00:00Z'));
const budgetOptions=()=>caps.map(cap=>`<option value="${cap}">Up to ${capText(cap)}</option>`).join('')+'<option value="any">No cap</option>';
const budgetValue=()=>state.budget??'any';
const readBudget=value=>value==='any'?null:Number(value);
let state=defaultState(),previous=null,pinned=null,history=[],selection=null,brushDomain=null,expanded=null,pageNumber=0;
let currentIDs=new Set(),newIDs=new Set(),cached=null,reviewMode='points';
const shortlist=new Set();
try {for(const id of JSON.parse(localStorage.getItem('fng-us-shortlist')||'[]'))if(byId.has(id))shortlist.add(id)}catch{}
const PAGE_SIZE=40;
const derived=()=>cached??(cached=GameCore.derive(games,state,tagIndex));
const candidates=()=>derived().candidates;
const ids=arr=>new Set(arr.map(g=>g.id));
const baseline=()=>$('compare-mode').value==='pinned'?pinned:previous;
const selected=g=>selection!==null&&selection.has(g.id);
const fresh=g=>newIDs.has(g.id);

function clearSelection(){selection=null;brushDomain=null;pageNumber=0}
function setSelection(items,domain=null){selection=ids(items);brushDomain=domain;pageNumber=0;render()}
function changeFilter(edit,freshSearch=false){
  const old={state:structuredClone(state),ids:ids(candidates())};
  edit();
  if(JSON.stringify(state)===JSON.stringify(old.state)&&!freshSearch)return;
  cached=null;clearSelection();
  if(freshSearch){history=[];previous=null;pinned=null;$('compare-mode').value='previous'}
  else {history.push(old);if(history.length>30)history.shift();previous=old.ids}
  render();
}
function selectSeed(g){
  changeFilter(()=>{
    state.seed=g.id;
    state.tags=g.tags.slice(0,3);state.tagOrigin='Suggested tags';
    state.rows=state.tags.length?[(1<<state.tags.length)-1]:[];
  },true);
  $('seed-search').value=g.name; renderSeeds();
  setSetupExpanded(!g.tags.length);
  if(g.tags.length)$('toggle-setup').focus({preventScroll:true});
}
function reset(){
  state=defaultState();reviewMode='points';cached=null;previous=null;pinned=null;history=[];clearSelection();
  $('compare-mode').value='previous';$('seed-search').value=byId.get(demo.seed).name;
  render();renderSeeds();setSetupExpanded(false);
}
// Keep the chosen game and tag requirements visible while freeing room for analysis.
function setSetupExpanded(open){
  $('setup').hidden=!open;
  $('search-summary').hidden=open;
  $('toggle-setup').setAttribute('aria-expanded',String(open));
  $('toggle-setup').textContent=open?'Collapse setup':'Edit search';
  $('search-heading').textContent=open?'Start with a game':(byId.get(state.seed)?.name||'Your tag search');
}
function renderSeeds(){
  const query=$('seed-search').value.trim(),{matches,total}=GameCore.search(games,query);
  const buttons=matches.map(g=>`<button class="seed-result" data-seed="${g.id}" aria-pressed="${state.seed===g.id}"><strong>${esc(g.name)}</strong><small>${esc(g.release||'Release date unavailable')} · App ID ${g.id}</small></button>`).join('');
  const note=!query?'Enter a title or a Steam app ID.':!total?'No matches in this snapshot. Try another title or choose tags manually.':total>20?`Showing 20 of ${count(total)} matches.`:`${count(total)} ${total===1?'match':'matches'}`;
  $('seed-results').innerHTML=`<div class="seed-options">${buttons}</div><div class="row seed-meta"><small>${note}</small><button id="manual-tags" class="text-btn">Choose tags manually</button></div>`;
  $('seed-results').querySelectorAll('[data-seed]').forEach(b=>b.onclick=()=>selectSeed(byId.get(b.dataset.seed)));
  $('manual-tags').onclick=()=>{changeFilter(()=>{state.seed=null;state.tags=[];state.rows=[];state.tagOrigin='Your choices'},true);$('seed-search').value='';renderSeeds();setSetupExpanded(true);$('add-tag').focus()};
}
function renderSetup(){
  const requirement=tagIndex=>state.rows.length&&state.rows.every(mask=>mask&(1<<tagIndex))?'required':'optional';
  $('search-summary').innerHTML=`<div class="summary-tags" aria-label="Current search tags">${state.tags.map((tag,i)=>`<span class="tag summary-tag">${esc(tag)} <small>${requirement(i)}</small></span>`).join('')||'<span class="note">Choose up to three tags.</span>'}</div><span class="summary-constraints">${state.budget===null?'No budget cap':`Up to ${capText(state.budget)}`} · ${platformName[state.os]}</span>`;
  if($('setup').hidden)$('search-heading').textContent=byId.get(state.seed)?.name||'Your tag search';
  $('budget').value=budgetValue();$('os').value=state.os;
  $('tags').innerHTML=state.tags.map(t=>`<button class="tag" data-remove="${esc(t)}" aria-label="Remove ${esc(t)} from the search">${esc(t)} <span aria-hidden="true">×</span></button>`).join('')||'<span class="note">Choose up to three tags.</span>';
  $('tag-choice-count').textContent=`${state.tagOrigin} · ${state.tags.length}/3`;
  $('tags').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>toggleSearchTag(b.dataset.remove));
  const seed=byId.get(state.seed),preferred=seed?seed.tags.filter(t=>!state.tags.includes(t)):[];
  const recorded=seed?.tags||[];
  $('recorded-tags').hidden=!recorded.length;
  $('recorded-tag-title').textContent=`Tags for this game (${recorded.length})`;
  $('recorded-tag-options').innerHTML=recorded.map(t=>{
    const active=state.tags.includes(t), full=state.tags.length>=3&&!active;
    return `<button class="tag-option" data-seed-tag="${esc(t)}" aria-pressed="${active}" aria-disabled="${full}">${esc(t)}</button>`;
  }).join('');
  $('recorded-tag-note').textContent=state.tags.length>=3?'Remove a selected tag to make room for another.':'Pick the traits you want to match, up to three.';
  $('recorded-tag-options').querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const tag=b.dataset.seedTag;
    if(toggleSearchTag(tag)){
      const next=[...$('recorded-tag-options').querySelectorAll('button')].find(node=>node.dataset.seedTag===tag);
      next?.focus({preventScroll:true});
    }
  });
  const rest=tagNames.filter(t=>!state.tags.includes(t)&&!preferred.includes(t));
  const opts=values=>values.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  $('add-tag').innerHTML=`<option value="">Pick a tag</option>${preferred.length?`<optgroup label="Recorded for this game">${opts(preferred)}</optgroup>`:''}<optgroup label="All catalog tags">${opts(rest)}</optgroup>`;
  $('add-tag').disabled=state.tags.length>=3;$('add-tag-button').disabled=true;
  $('seed-note').textContent=seed?(seed.tags.length?`Choose from the recorded tags above, or add another catalog tag.`:'No tags were recorded for this game. Choose tags manually to start.'):'Pick up to three tags to explore without a starting game.';
  const relaxed=state.tags.length>1&&JSON.stringify(GameCore.relaxRows(state.rows,state.tags.length))!==JSON.stringify([...state.rows].sort((a,b)=>a-b));
  $('relax').disabled=!relaxed;
  $('relax').textContent=state.tags.length>1?`Make ${state.tags.at(-1)} optional`:'Choose two tags to relax';
}
function toggleSearchTag(tag){
  if(!state.tags.includes(tag)&&state.tags.length>=3){
    $('recorded-tag-note').textContent='Three tags are selected. Remove one to make room.';
    return false;
  }
  changeFilter(()=>{
    state.tags=state.tags.includes(tag)?state.tags.filter(t=>t!==tag):[...state.tags,tag];
    state.rows=state.tags.length?[(1<<state.tags.length)-1]:[];
    state.tagOrigin='Your choices';
  },true);
  return true;
}
function showTip(e,text){
  // A native modal sits in the browser top layer; its tooltip must live inside it.
  const t=$('tooltip'),host=$('modal').open?$('modal'):document.body;
  if(t.parentElement!==host)host.append(t);
  t.textContent=text;t.hidden=false;
  const rect=e.target.getBoundingClientRect(),x=e.clientX||rect.left,y=e.clientY||rect.bottom;
  t.style.left=`${Math.max(8,Math.min(x+12,innerWidth-t.offsetWidth-8))}px`;
  t.style.top=`${Math.max(8,Math.min(y+12,innerHeight-t.offsetHeight-8))}px`;
}
function tips(el){el.querySelectorAll('[data-tip]').forEach(n=>{
  n.onpointermove=e=>showTip(e,n.dataset.tip);n.onfocus=e=>showTip(e,n.dataset.tip);
  n.onpointerleave=n.onblur=()=>{$('tooltip').hidden=true};
})}
function openModal(title,kicker){
  $('modal-title').textContent=title;$('modal-kicker').textContent=kicker;
  $('modal').classList.toggle('chart-open',Boolean(expanded));
  if(!$('modal').open)$('modal').showModal();$('tooltip').hidden=true;
}
function bars(n,s,max,kind=''){
  return `<span class="bar-track"><span class="bar-base ${kind}" style="width:${n/max*100}%"><span class="bar-selected" style="width:${n?s/n*100:0}%"></span></span></span>`;
}
function numeric(n,s){return s?`<b class="selected-count">${count(s)}</b><span> / ${count(n)}</span>`:count(n)}
function renderA(el){
  const {patterns}=derived();
  const masks=Array.from({length:(1<<state.tags.length)-1},(_,i)=>i+1).sort((a,b)=>bitCount(b)-bitCount(a)||b-a);
  const max=Math.max(1,...masks.map(m=>patterns.get(m)?.length??0));
  el.innerHTML=state.tags.length?`<p class="note matrix-help"><strong>Highlight</strong> shows a row’s games in Reviews, Prices, and the list. Check a box to include that combination.</p><p class="chart-key">${state.tags.map((t,i)=>`<span><b>${i+1}</b> ${esc(t)}</span>`).join('')}</p><div class="matrix">${masks.map(m=>{
    const gs=patterns.get(m)||[],n=gs.length,s=gs.filter(selected).length,on=state.rows.includes(m);
    const label=state.tags.map((t,i)=>(m&(1<<i)?'Has ':'No recorded ')+t).join('; ');
    const canHighlight=on&&n>0;
    const action=canHighlight?'<span class="matrix-action" aria-hidden="true">Highlight</span>':'';
    return `<div class="matrix-row"><input type="checkbox" data-row="${m}" ${on?'checked':''} aria-label="Include ${esc(label)}"><button class="matrix-btn" data-select-row="${m}" aria-label="Highlight games: ${esc(label)}" ${canHighlight?'':'disabled'} data-tip="${esc(label)} · ${count(n)} games within budget and platform"><span class="matrix-label"><span class="pattern" aria-hidden="true">${state.tags.map((_,i)=>m&(1<<i)?'●':'○').join(' ')}</span><span class="matrix-count">${numeric(n,s)}</span>${action}</span>${bars(n,s,max,on?'':'context')}</button></div>`;
  }).join('')}</div><div class="chart-scale"><span>0</span><span>Games</span><span>${count(max)}</span></div><p class="note">Each row is one exact combination. Counts use the current budget and platform.</p>`:'<p class="empty">Choose tags to see how games match.</p>';
  el.querySelectorAll('[data-row]').forEach(checkbox=>checkbox.onchange=()=>{
    const mask=Number(checkbox.dataset.row);
    changeFilter(()=>{
      state.rows=checkbox.checked?[...state.rows,mask]:state.rows.filter(row=>row!==mask);
    });
    el.querySelector(`[data-row="${mask}"]`)?.focus({preventScroll:true});
  });
  el.querySelectorAll('[data-select-row]').forEach(button=>button.onclick=()=>{
    const mask=Number(button.dataset.selectRow);
    setSelection(patterns.get(mask)||[]);
    el.querySelector(`[data-select-row="${mask}"]`)?.focus({preventScroll:true});
  });
  tips(el);
}
const bitCount=n=>n.toString(2).replaceAll('0','').length;

// A fixed grid in log-review and positive-rate space keeps cells comparable
// between the overview and the expanded chart. Each game belongs to one cell.
function reviewGrid(plotted,x,y){
  const cols=20,rows=10,[left,right]=x.range(),[bottom,top]=y.range();
  const cw=(right-left)/cols,ch=(bottom-top)/rows,cells=new Map();
  const key=(px,py)=>Math.min(cols-1,Math.max(0,Math.floor((px-left)/cw)))+cols*Math.min(rows-1,Math.max(0,Math.floor((py-top)/ch)));
  for(const g of plotted){
    const k=key(x(g.reviews),y(g.rate));
    if(!cells.has(k)){
      const x0=left+(k%cols)*cw,y0=top+Math.floor(k/cols)*ch;
      cells.set(k,{x0,y0,x1:x0+cw,y1:y0+ch,games:[],newCount:0,selectedCount:0});
    }
    const cell=cells.get(k);
    cell.games.push(g);
    if(fresh(g))cell.newCount++;
    if(selected(g))cell.selectedCount++;
  }
  return {cells:[...cells.values()],at:(px,py)=>px<left||px>right||py<top||py>bottom?undefined:cells.get(key(px,py))};
}

// Review mode changes the marks; it never changes the active candidate set.
function renderB(el) {
  const gs=candidates(),plotted=gs.filter(hasReviewRate),dense=reviewMode==='density';
  const w=Math.max(200,Math.floor(el.getBoundingClientRect().width));
  const h=el.id==='expanded-chart'?Math.max(340,Math.min(700,Math.round(innerHeight*.65))):Math.max(340,Math.min(400,Math.round(innerHeight*.43)));
  const l=48,r=14,t=30,b=50;
  const x=d3.scaleLog().domain([1,10**maxPower]).range([l+6,w-r-6]);
  const y=d3.scaleLinear().domain([0,100]).range([h-b-6,t+6]);
  const grid=dense?reviewGrid(plotted,x,y):null;
  const peak=grid?d3.max(grid.cells,c=>c.games.length)||0:0;
  const densityLegend=peak?`<div class="legend"><span>Games per cell</span><span class="density-ramp" aria-hidden="true"></span><span>${peak===1?'1':`1–${count(peak)}`}</span>${selection!==null?'<span><i class="outline-key"></i> Contains selected games</span>':''}</div>`:'';
  const pointLegend='<div class="legend review-legend"><span><i class="mark-key retained-key"></i> Retained / current</span><span><i class="mark-key new-key"></i> NEW vs chosen baseline</span><span><i class="mark-key selected-key"></i> Selected (circle or diamond)</span></div>';
  el.innerHTML=`<div class="review-controls"><div class="review-mode" role="group" aria-label="Review chart display"><button type="button" data-review-mode="points" aria-pressed="${!dense}">Points</button><button type="button" data-review-mode="density" aria-pressed="${dense}">Density</button></div><p class="note">${dense?'Darker cells contain more games. Click or drag across cells to select.':'Hover for details, click to open a game, or drag to select.'}</p></div><div class="plot-wrap" style="height:${h}px"><canvas aria-hidden="true"></canvas><svg class="chart-svg" width="${w}" height="${h}" role="img" aria-label="Review ${dense?'density grid':'scatterplot'}; ${plotted.length} games. Drag to select; game names and exact values are available in the table."></svg></div>${dense?densityLegend:pointLegend}<p class="note">${count(plotted.length)} of ${count(gs.length)} plotted · ${count(gs.length-plotted.length)} without a defined review rate. Games without reviews still appear in the list.</p>`;
  el.querySelectorAll('[data-review-mode]').forEach(button=>button.onclick=()=>{
    if(reviewMode===button.dataset.reviewMode)return;
    reviewMode=button.dataset.reviewMode;brushDomain=null;$('tooltip').hidden=true;
    renderCharts();el.querySelector(`[data-review-mode="${reviewMode}"]`).focus({preventScroll:true});
  });
  const canvas=el.querySelector('canvas'),ratio=window.devicePixelRatio||1;
  canvas.width=w*ratio;canvas.height=h*ratio;canvas.style.width=w+'px';canvas.style.height=h+'px';
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  const palette=getComputedStyle(el);
  const ink={selected:palette.getPropertyValue('--blue').trim(),normal:palette.getPropertyValue('--point').trim(),muted:palette.getPropertyValue('--pale').trim(),outline:palette.getPropertyValue('--point-outline').trim()};
  if(dense){
    const color=d3.scaleLinear().domain([1,Math.max(2,peak)]).range([ink.muted,ink.selected]);
    for(const cell of grid.cells){
      const {x0,y0,x1,y1,games,selectedCount}=cell;
      ctx.fillStyle=peak===1?ink.muted:color(games.length);
      ctx.fillRect(x0+.5,y0+.5,x1-x0-1,y1-y0-1);
      if(selectedCount){
        ctx.strokeStyle=ink.outline;ctx.lineWidth=1.6;
        ctx.strokeRect(x0+1,y0+1,x1-x0-2,y1-y0-2);
      }
    }
  }else for(const g of [...plotted.filter(g=>!selected(g)),...plotted.filter(selected)]) {
    const cx=x(g.reviews),cy=y(g.rate),isNew=fresh(g);
    const focused=selected(g),context=selection!==null&&!focused;
    const radius=focused?5:4;
    // NEW remains a diamond when selected. A filled accent and outer ring add
    // selection without replacing the baseline membership shape.
    ctx.globalAlpha=context ? 0.38 : 1;
    ctx.fillStyle=focused?ink.selected:isNew?'#ffffff':ink.normal;
    ctx.strokeStyle=focused?'#102b3b':isNew?ink.selected:ink.outline;
    ctx.lineWidth=focused?1.8:isNew?1.7:.7;
    ctx.beginPath();
    if(isNew){const a=radius*1.25;ctx.moveTo(cx,cy-a);ctx.lineTo(cx+a,cy);ctx.lineTo(cx,cy+a);ctx.lineTo(cx-a,cy);ctx.closePath()}
    else ctx.arc(cx,cy,radius,0,Math.PI*2);
    if(focused){ctx.save();ctx.strokeStyle='#ffffff';ctx.lineWidth=5;ctx.stroke();ctx.restore()}
    ctx.fill();ctx.stroke();ctx.globalAlpha=1;
  }
  const svg=d3.select(el.querySelector('svg'));
  svg.append('rect').attr('x',l).attr('y',t).attr('width',w-l-r).attr('height',h-t-b).attr('fill','none').attr('stroke','#c5cfd4');
  const powers=d3.range(maxPower+1).filter(i=>w>=370||i%2===0||i===maxPower).map(i=>10**i);
  svg.append('g').attr('transform',`translate(0,${h-b})`).call(d3.axisBottom(x).tickValues(powers).tickFormat(d3.format('~s')).tickSizeOuter(0));
  svg.append('g').attr('transform',`translate(${l},0)`).call(d3.axisLeft(y).tickValues([0,25,50,75,100]).tickSizeOuter(0));
  svg.append('text').attr('x',l).attr('y',15).text('Positive review rate (%)');
  svg.append('text').attr('x',l+(w-l-r)/2).attr('y',h-8).attr('text-anchor','middle').text('Total reviews · log₁₀ scale');
  if(!dense)labelReviewCandidates(svg,plotted,x,y,w,h,l,r,t,b,el);
  const tree=dense?null:d3.quadtree().x(g=>x(g.reviews)).y(g=>y(g.rate)).addAll(plotted);
  const cellDomain=([[x0,y0],[x1,y1]])=>[[x.invert(x0),y.invert(y1)],[x.invert(x1),y.invert(y0)]];
  let brushing=false;
  const brush=d3.brush().extent([[l,t],[w-r,h-b]])
    .on('start',event=>{if(event.sourceEvent){brushing=true;$('tooltip').hidden=true}})
    .on('end',event=>{
      if(!event.sourceEvent)return;
      brushing=false;
      if(event.selection){
        const [[x0,y0],[x1,y1]]=event.selection;
        const games=dense?grid.cells.filter(c=>c.x0<x1&&c.x1>x0&&c.y0<y1&&c.y1>y0).flatMap(c=>c.games):plotted.filter(g=>x(g.reviews)>=x0&&x(g.reviews)<=x1&&y(g.rate)>=y0&&y(g.rate)<=y1);
        setSelection(games,cellDomain(event.selection));
      }else{
        const [px,py]=d3.pointer(event.sourceEvent,svg.node());
        const hit=dense?grid.at(px,py):tree.find(px,py,11);
        if(!hit){clearSelection();render()}
        else if(dense)setSelection(hit.games);
        else{setSelection([hit]);openDetails(hit)}
      }
    });
  const layer=svg.append('g').attr('class','brush').call(brush);
  if(brushDomain){const [[x0,y0],[x1,y1]]=brushDomain;layer.call(brush.move,[[x(x0),y(y1)],[x(x1),y(y0)]]);}
  const approx=d3.format('.2~s');
  svg.on('pointermove.tooltip',function(event){
    if(brushing)return;
    const [px,py]=d3.pointer(event,this),hit=dense?grid.at(px,py):tree.find(px,py,11);
    if(!hit){$('tooltip').hidden=true;return}
    if(dense){
      const {games,x0,x1,y0,y1,newCount,selectedCount}=hit;
      showTip(event,`${count(games.length)} ${games.length===1?'game':'games'} in this cell\n≈${approx(x.invert(x0))}–${approx(x.invert(x1))} reviews · ${Math.round(y.invert(y1))}–${Math.round(y.invert(y0))}% positive\n${count(newCount)} NEW · ${count(selectedCount)} selected`);
    }else showTip(event,`${hit.name}\n${money(hit.price)} · ${rateText(hit.rate)} · ${count(hit.reviews)} reviews`);
  }).on('pointerleave.tooltip',()=>{$('tooltip').hidden=true});
}

// Label review-volume leaders, using the selected group when one exists.
// These are evidence-volume labels rather than a recommendation score.
function labelReviewCandidates(svg,plotted,x,y,w,h,l,r,t,b,el){
  const leaders=plotted.filter(g=>selection===null||selected(g))
    .sort((a,b)=>b.reviews-a.reviews||a.id.localeCompare(b.id)).slice(0,w<420?2:3);
  if(!leaders.length)return;
  const annotations=svg.append('g').attr('class','review-labels').attr('pointer-events','none');
  const maxChars=w<420?18:25;
  const placements=[];
  for(const game of leaders){
    const name=game.name.length>maxChars?game.name.slice(0,maxChars-1)+'…':game.name;
    const label=annotations.append('g').attr('data-label-game',game.id);
    label.append('title').text(`${game.name} · ${count(game.reviews)} reviews · ${rateText(game.rate)}`);
    const text=label.append('text').attr('class','candidate-label').text(name);
    const textWidth=text.node().getComputedTextLength();
    const px=x(game.reviews),py=y(game.rate);
    const lx=Math.max(l+5,Math.min(px+11,w-r-textWidth-5));
    let ly=Math.max(t+18,Math.min(py-12,h-b-10));
    while(placements.some(other=>Math.abs(ly-other.y)<23&&lx<other.x+other.width+8&&lx+textWidth+8>other.x))ly+=23;
    if(ly>h-b-10)ly=t+18;
    placements.push({x:lx,y:ly,width:textWidth});
    label.insert('line','text').attr('x1',px).attr('y1',py).attr('x2',lx).attr('y2',ly-4).attr('class','label-leader');
    label.insert('rect','text').attr('x',lx-4).attr('y',ly-13).attr('width',textWidth+8).attr('height',18).attr('rx',3).attr('class','label-background');
    text.attr('x',lx).attr('y',ly);
  }
  const note=document.createElement('p');
  note.className='note review-label-note';
  note.textContent=`Labels show the ${leaders.length} most-reviewed ${selection===null?'candidates':'selected games'}.`;
  el.append(note);
}

function renderC(el){
  const groups=derived().priceGroups,max=Math.max(1,...groups.map(gs=>gs.length));
  const populated=groups.map((gs,i)=>({gs,i})).filter(({gs})=>gs.length);
  const hiddenBands=groups.length-populated.length;
  el.innerHTML=`<div class="price-list">${populated.map(({gs,i})=>{
    const eligible=gs.filter(g=>inBudget(g.price,state.budget)),s=eligible.filter(selected).length;
    const note=i===labels.length-1?'No confirmed price in this snapshot':`${count(gs.length)} games · ${count(eligible.length)} within budget · ${count(s)} selected`;
    return `<button class="price-row" data-band="${i}" ${eligible.length?'':'disabled'} data-tip="${esc(note)}"><span>${labels[i]}</span>${bars(gs.length,s,max,eligible.length?'':'context')}<span class="num">${numeric(gs.length,s)}</span></button>`;
  }).join('')||'<p class="empty">No games match the current tags and platform.</p>'}</div><div class="chart-scale"><span>0</span><span>Games</span><span>${count(max)}</span></div><div class="legend"><span><i class="swatch"></i> Selected</span><span><i class="swatch pale"></i> Eligible</span><span><i class="swatch neutral"></i> Outside cap</span></div><div class="row band-budget"><label for="budget-${el.id}">Budget cap</label><select id="budget-${el.id}" data-inline-budget>${budgetOptions()}</select></div><p class="note">Counts show matching tags and platform before the budget cap.${hiddenBands?` ${hiddenBands} empty ${hiddenBands===1?'band is':'bands are'} hidden.`:''}${state.budget!==null&&groups.at(-1).length?` ${count(groups.at(-1).length)} games have an unverified price and are excluded from this budget.`:''}</p>`;
  const cap=el.querySelector('[data-inline-budget]');cap.value=budgetValue();cap.onchange=e=>changeFilter(()=>state.budget=readBudget(e.target.value));
  el.querySelectorAll('[data-band]').forEach(n=>n.onclick=()=>setSelection(groups[+n.dataset.band].filter(g=>inBudget(g.price,state.budget))));tips(el);
}
const charts={a:renderA,b:renderB,c:renderC};
function renderCharts(){
  if(!$('sketch').hidden)for(const [key,draw] of Object.entries(charts))draw($('view-'+key));
  if(expanded&&$('expanded-chart'))charts[expanded]($('expanded-chart'));
}
function sorted(gs){
  const key=$('sort').value, compare={price:(a,b)=>(a.price??Infinity)-(b.price??Infinity),reviews:(a,b)=>b.reviews-a.reviews,name:(a,b)=>a.name.localeCompare(b.name,'en-US'),rating:(a,b)=>(b.rate??-1)-(a.rate??-1)}[key];
  return [...gs].sort((a,b)=>compare(a,b)||a.name.localeCompare(b.name,'en-US'));
}
function table(gs,compact=false){
  return `<table><thead><tr><th scope="col">Save</th><th scope="col">Game</th><th scope="col" class="num">Price (USD)</th><th scope="col" class="num">Positive</th><th scope="col" class="num">Reviews</th>${compact?'':'<th scope="col">Owner group</th>'}</tr></thead><tbody>${gs.map(g=>`<tr><td><button class="star" data-save="${g.id}" aria-pressed="${shortlist.has(g.id)}" aria-label="${shortlist.has(g.id)?'Remove':'Save'} ${esc(g.name)}">${shortlist.has(g.id)?'★':'☆'}</button></td><td><button class="name-btn" data-details="${g.id}">${esc(g.name)}</button>${fresh(g)?'<span class="new">NEW</span>':''}</td><td class="num">${money(g.price)}</td><td class="num">${rateText(g.rate)}</td><td class="num">${count(g.reviews)}</td>${compact?'':`<td>${g.owner==null?'—':`<span class="owners" aria-hidden="true">${'▰'.repeat(g.owner)}${'▱'.repeat(5-g.owner)}</span><br><small>${ownerLabels[g.owner-1]}</small>`}</td>`}</tr>`).join('')}</tbody></table>`;
}
function toggleSave(id){
  if(shortlist.has(id))shortlist.delete(id);else shortlist.add(id);
  try{localStorage.setItem('fng-us-shortlist',JSON.stringify([...shortlist]))}catch{}
  renderList();
}
function bindTable(el){
  el.querySelectorAll('[data-details]').forEach(n=>n.onclick=()=>{const g=byId.get(n.dataset.details);if(currentIDs.has(g.id))setSelection([g]);openDetails(g)});
  el.querySelectorAll('[data-save]').forEach(n=>n.onclick=()=>{toggleSave(n.dataset.save);if($('modal').open&&$('modal-body').dataset.kind==='compare')openComparison()});
}
function renderList(){
  const gs=sorted(candidates().filter(g=>selection===null||selected(g)));
  pageNumber=Math.min(pageNumber,Math.max(0,Math.ceil(gs.length/PAGE_SIZE)-1));
  $('list-count').textContent=count(gs.length);
  const pageStart=pageNumber*PAGE_SIZE, pageRows=gs.slice(pageStart,pageStart+PAGE_SIZE);
  $('list-context').textContent=gs.length?`Showing ${count(pageStart+1)}–${count(pageStart+pageRows.length)} of ${count(gs.length)} ${selection===null?'candidates':'selected games'}.`:(selection===null?'No matches under the current filters.':'Clear selection to see all candidates.');
  $('candidate-list').innerHTML=pageRows.length?table(pageRows):`<p class="empty">${selection===null?'No candidates yet. Try checking another tag row, raising the budget, or choosing another platform.':'No candidates are highlighted. Clear selection to show all matches.'}</p>`;
  $('page-status').textContent=gs.length?`${count(pageNumber*PAGE_SIZE+1)}–${count(Math.min((pageNumber+1)*PAGE_SIZE,gs.length))} of ${count(gs.length)}`:'0 results';
  $('prev-page').disabled=pageNumber===0;$('next-page').disabled=(pageNumber+1)*PAGE_SIZE>=gs.length;
  $('short-count').textContent=count(shortlist.size);
  $('shortlist').innerHTML=[...shortlist].map(id=>`<div class="shortlist-item"><button class="name-btn" data-details="${id}">${esc(byId.get(id).name)}</button><button data-save="${id}" aria-label="Remove ${esc(byId.get(id).name)}">×</button></div>`).join('')||'<p class="note">Use the star next to a game to save it here.</p>';
  $('compare-shortlist').disabled=shortlist.size<2;$('export-shortlist').disabled=!shortlist.size;
  bindTable($('candidate-list'));bindTable($('shortlist'));
}
function detailTags(g){
  const recorded=new Set(g.tags);
  const matching=state.tags.filter(tag=>recorded.has(tag));
  const missing=state.tags.filter(tag=>!recorded.has(tag));
  const other=g.tags.filter(tag=>!state.tags.includes(tag));
  const chips=(tags,style='')=>tags.map(tag=>`<span class="tag ${style}">${esc(tag)}</span>`).join('');
  const evidence=state.tags.length?`<section class="detail-tag-match" aria-label="Search tag matches"><div class="detail-tag-heading"><h3>Matching search tags</h3><span class="pill">${matching.length} of ${state.tags.length} matched</span></div><div class="tags">${chips(matching,'tag-match')||'<span class="note">None of the current search tags are recorded for this game.</span>'}</div>${missing.length?`<p class="note detail-tag-missing"><strong>Not recorded:</strong> ${missing.map(esc).join(', ')}</p>`:''}</section>`:'';
  const others=other.length||!state.tags.length?`<section class="detail-tag-other"><h3>${state.tags.length?'Other recorded tags':'Recorded tags'}</h3><div class="tags">${chips(other)||'<span class="note">No recorded tags</span>'}</div></section>`:'';
  return evidence+others;
}
function openDetails(g){
  expanded=null;openModal(g.name,`STEAM APP ID ${g.id} · ${SNAPSHOT.toUpperCase()}`);$('modal-body').dataset.kind='details';
  const fields=[['Snapshot price (USD)',money(g.price)],['Positive review rate',rateText(g.rate)],['Total reviews',count(g.reviews)],['Estimated owners',g.rawOwners||'Unrecorded'],['Platforms',g.platforms.map(p=>platformName[p]).join(', ')||'Unrecorded'],['Release date',g.release||'Unrecorded']];
  $('modal-body').innerHTML=`${detailTags(g)}<dl class="detail-grid">${fields.map(([title,value])=>`<div><dt>${title}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><p class="note">Genres: ${esc(g.genres.join(', ')||'Unrecorded')}. ${g.price==null?'The source reports zero without confirming whether the game is free or its price is missing.':'The recorded U.S. price may reflect a discount at the time.'}</p><div class="row"><a class="text-btn" href="https://store.steampowered.com/app/${g.id}/?cc=us" target="_blank" rel="noopener">Check Steam ↗</a><button id="detail-save">${shortlist.has(g.id)?'Remove from shortlist':'Save to shortlist'}</button></div>`;
  $('detail-save').onclick=()=>{toggleSave(g.id);openDetails(g)};
}
function openComparison(){
  expanded=null;openModal('Compare saved games','SHORTLIST');$('modal-body').dataset.kind='compare';
  $('modal-body').innerHTML=`<div class="table-wrap">${table([...shortlist].map(id=>byId.get(id)),true)}</div>`;bindTable($('modal-body'));
}
function render(){
  $('tooltip').hidden=true;
  const gs=candidates();
  currentIDs=ids(gs);
  const plotted=gs.filter(hasReviewRate).length, unplotted=gs.length-plotted;
  $('review-coverage').textContent=`Review plot: ${count(plotted)} of ${count(gs.length)} candidates${unplotted?` · ${count(unplotted)} without reviews`:""}`;
  const base=baseline(),{added,removed}=GameCore.difference(currentIDs,base);
  newIDs=new Set(added);
  $('status').innerHTML=`${count(currentIDs.size)} <small>candidates</small>${selection===null?'':` <span>·</span> ${count(selection.size)} <small>selected</small>`}`;
  $('comparison').textContent=base?`${count(base.size)} before → ${count(currentIDs.size)} now · +${count(added.length)} NEW · −${count(removed.length)} removed`:'Change a filter to see which games enter or leave.';
  $('condition-label').textContent=`${state.tags.length} tags · ${state.budget===null?'No budget cap':`Up to ${capText(state.budget)}`} · ${platformName[state.os]}`;
  $('undo').disabled=!history.length;$('clear').disabled=selection===null;
  $('compare-mode').querySelector('[value=pinned]').disabled=pinned===null;
  renderSetup();renderCharts();renderList();
}
const channels=[
  ['Recorded tag membership','Nominal, multi-label','Dot matrix','Filled / hollow; tag column','Expressiveness','Fill means recorded membership. Column position names a tag without implying rank.'],
  ['Games in a tag combination or price band','Quantitative count','Bar','Length from zero','Effectiveness','Common baselines support comparisons within each view.'],
  ['Review count','Quantitative count','Point','Horizontal log position','Effectiveness','Reveals orders of magnitude; games with zero reviews have no plotted point.'],
  ['Positive review rate','Quantitative proportion','Point','Vertical linear position','Effectiveness','A common 0–100% scale supports direct comparisons of positive share.'],
  ['Games per review cell','Quantitative count','Equal-area grid cell','Sequential lightness; shared review axes','Expressiveness','Density counts every plotted game once. An outline identifies cells with selected games; hover provides exact counts, including NEW.'],
  ['U.S. price bands','Ordinal categories from USD amounts','Bar row','Ordered vertical position','Expressiveness','Ascending bands support budget exploration. Empty bands are hidden and labeled as such; Unverified remains separate.'],
  ['Owner estimate group','Ordinal estimate group','Segment meter','Ordered number of filled segments','Expressiveness','Segments encode rank, and Details exposes the original estimate range.'],
  ['NEW / retained; selected / unselected','Derived comparison and selection states','Points, bars, labels','Shape, fill, outline, and text','Redundant cues','Hollow diamonds identify newly included games; filled circles identify retained games. Selected points keep their shape and gain blue fill and a contrasting ring. Names label the most-reviewed candidates.']
];
$('channel-table').innerHTML=`<table><thead><tr>${['Data Variable','Data Type','Mark','Channel','Principle','Justification'].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${channels.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
$('catalog-count').textContent=count(meta.games);
$('catalog-price-count').textContent=`${count(meta.usd_prices)} with a recorded USD price`;
$('snapshot-date').textContent=`${SNAPSHOT} snapshot`;
$('provenance-lead').textContent=`This dashboard uses the ${SNAPSHOT} snapshot of Fronkon Games’ Steam Games Dataset (version 44), distributed as a factual metadata package by Eskuel.`;
$('data-summary').innerHTML=`<h2>Catalog coverage</h2><p class="note">Title search covers the entire catalog. Chart counts reflect your filters and the fields each view needs. Missing-field counts can overlap.</p><dl class="data-grid">${[['Game records',meta.games],['Recorded USD prices',meta.usd_prices],['Unverified price',meta.unverified_zero],['No recorded tags',meta.no_tags],['No reviews',meta.zero_reviews],['Distinct tags',meta.distinct_tags]].map(([k,v])=>`<div><dt>${k}</dt><dd>${count(v)}</dd></div>`).join('')}</dl>`;
$('budget').innerHTML=budgetOptions();
$('seed-search').oninput=renderSeeds;
$('add-tag').onchange=()=>{$('add-tag-button').disabled=!$('add-tag').value};
$('add-tag-button').onclick=()=>{
  const tag=$('add-tag').value;
  if(tag)toggleSearchTag(tag);
};
$('budget').onchange=e=>changeFilter(()=>state.budget=readBudget(e.target.value));
$('os').onchange=e=>changeFilter(()=>state.os=e.target.value);
$('relax').onclick=()=>changeFilter(()=>state.rows=GameCore.relaxRows(state.rows,state.tags.length));
$('clear').onclick=()=>{clearSelection();render()};$('reset').onclick=reset;
$('undo').onclick=()=>{
  const last=history.pop();if(!last)return;
  previous=ids(candidates());state=last.state;cached=null;clearSelection();render();
};
$('pin').onclick=()=>{pinned=ids(candidates());$('compare-mode').value='pinned';render()};
$('compare-mode').onchange=render;
$('sort').onchange=()=>{pageNumber=0;renderList()};
$('prev-page').onclick=()=>{pageNumber--;renderList()};$('next-page').onclick=()=>{pageNumber++;renderList()};
$('compare-shortlist').onclick=openComparison;
$('export-shortlist').onclick=()=>{
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const safe=v=>/^[\s\t\r\n]*[=+@-]/.test(v)?"'"+v:v;
  const records=[['appid','name','price_usd','price_status','snapshot_date','positive_rate','reviews','recorded_tags']];
  for(const id of shortlist){const g=byId.get(id);records.push([g.id,safe(g.name),g.price===null?'':(g.price/100).toFixed(2),g.price===null?'unverified':'recorded',meta.snapshot,g.rate,g.reviews,safe(g.tags.join(';'))])}
  const url=URL.createObjectURL(new Blob(['\ufeff'+records.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='steam-shortlist-usd.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('toggle-setup').onclick=()=>{setSetupExpanded($('setup').hidden);renderCharts()};
function setGrayscale(on){
  document.body.classList.toggle('gray',on);
  $('gray').setAttribute('aria-pressed',on);
  $('gray').textContent=on?'Exit grayscale preview':'Preview charts in grayscale';
  $('restore-color').hidden=!on;
}
$('gray').onclick=()=>{
  const on=!document.body.classList.contains('gray');
  setGrayscale(on);
  if(on){$('tab-sketch').click();$('restore-color').focus()}
};
$('restore-color').onclick=()=>{setGrayscale(false);$('tab-sketch').focus()};
$('close-modal').onclick=()=>$('modal').close();
$('modal').addEventListener('close',()=>{expanded=null;$('modal').classList.remove('chart-open');$('tooltip').hidden=true});
document.querySelectorAll('[data-expand]').forEach(b=>b.onclick=()=>{
  expanded=b.dataset.expand;openModal({a:'Shared tags',b:'Reviews',c:'Prices in USD'}[expanded],'EXPANDED VIEW');
  $('modal-body').dataset.kind='chart';$('modal-body').innerHTML='<div id="expanded-chart"></div>';renderCharts();
});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('[data-tab]').forEach(other=>other.setAttribute('aria-pressed',other===b));
  document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==b.dataset.tab);
  if(b.dataset.tab==='sketch')requestAnimationFrame(renderCharts);
});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderCharts,120)});
reset();
