/* Shared catalog and comparison rules for the U.S. dashboard. Money is integer cents. */
(function(root){
  'use strict';
  const currency='USD';
  const caps=Object.freeze([500,1000,1500,2000,3000,6000]);
  const dollars=new Intl.NumberFormat('en-US',{style:'currency',currency});
  const wholeDollars=new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:0});
  const money=cents=>cents==null?'Unverified':dollars.format(cents/100);
  const capText=cents=>cents==null?'No cap':wholeDollars.format(cents/100);
  const labels=Object.freeze(caps.map((cap,i)=>i?`${capText(caps[i-1])}–${capText(cap)}`:`Up to ${capText(cap)}`).concat(`Over ${capText(caps.at(-1))}`,'Unverified'));
  const priceBand=cents=>{
    if(cents==null)return caps.length+1;
    const index=caps.findIndex(cap=>cents<=cap);
    return index===-1?caps.length:index;
  };
  const inBudget=(cents,cap)=>cap===null||(cents!==null&&cents<=cap);
  const fold=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const matchMask=(g,tags)=>tags.reduce((m,tag,i)=>m|(g.tags.includes(tag)?1<<i:0),0);
  function unpack(catalog){
    return catalog.rows.map(([id,name,release,tags,genres,os,price,positive,negative,lo,hi])=>{
      const reviews=positive+negative;
      const owner=hi==null?null:hi<=50000?1:hi<=200000?2:hi<=1000000?3:hi<=5000000?4:5;
      return {id:String(id),name,searchName:fold(name),release,tags:tags.map(i=>catalog.tags[i]),genres:genres.map(i=>catalog.genres[i]),
        platforms:['windows','mac','linux'].filter((_,i)=>os&(1<<i)),price,reviews,rate:reviews?positive/reviews*100:null,owner,
        rawOwners:hi==null?null:`${lo.toLocaleString('en-US')}–${hi.toLocaleString('en-US')}`};
    });
  }
  // Index tag membership once. Each render checks only the union of the selected tags.
  function indexTags(games){
    const index=new Map();
    for(const g of games)for(const tag of g.tags){
      if(!index.has(tag))index.set(tag,[]);
      index.get(tag).push(g);
    }
    return index;
  }
  function derive(games,state,index){
    const context=[],candidates=[],patterns=new Map(),priceGroups=labels.map(()=>[]),masks=new Map();
    const relevant=index?new Set(state.tags.flatMap(tag=>index.get(tag)||[])):games;
    for(const g of relevant){
      if(g.id===state.seed||(state.os!=='any'&&!g.platforms.includes(state.os)))continue;
      const mask=matchMask(g,state.tags);
      if(!mask)continue;
      masks.set(g.id,mask);
      const eligible=inBudget(g.price,state.budget);
      if(eligible){
        if(!patterns.has(mask))patterns.set(mask,[]);
        patterns.get(mask).push(g);
      }
      if(!state.rows.includes(mask))continue;
      context.push(g);
      priceGroups[priceBand(g.price)].push(g);
      if(eligible)candidates.push(g);
    }
    return {context,candidates,patterns,priceGroups,masks};
  }
  function relaxRows(rows,count){
    const bit=1<<(count-1);
    return [...new Set(rows.flatMap(mask=>[mask,mask^bit]).filter(Boolean))].sort((a,b)=>a-b);
  }
  const difference=(now,base)=>base===null?{added:[],removed:[]}:{added:[...now].filter(id=>!base.has(id)),removed:[...base].filter(id=>!now.has(id))};
  function search(games,query,limit=20){
    const q=fold(query);
    if(!q)return {matches:[],total:0};
    const found=games.filter(g=>(g.searchName||fold(g.name)).includes(q)||g.id===q);
    const score=g=>g.id===q?3:g.searchName===q?2:g.searchName.startsWith(q)?1:0;
    found.sort((a,b)=>score(b)-score(a)||b.reviews-a.reviews||a.name.localeCompare(b.name));
    return {matches:found.slice(0,limit),total:found.length};
  }
  const api={currency,caps,labels,money,capText,priceBand,inBudget,fold,unpack,indexTags,derive,matchMask,relaxRows,difference,search};
  root.GameCore=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
