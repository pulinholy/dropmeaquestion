// Layout check: for each scene, make sure everything fits and save a frame.
const path=require('path'),fs=require('fs');const puppeteer=require('puppeteer-core');
const vertical=process.argv.includes('--vertical');const file=process.argv[2]||'explainer-v2.html';
const W=vertical?1080:1920,H=vertical?1920:1080;
const times=(process.argv.find(a=>a.startsWith('--times='))||'').slice(8).split(',').filter(Boolean).map(Number);
(async()=>{
 const exe='C:/Program Files/Google/Chrome/Application/chrome.exe';
 const b=await puppeteer.launch({executablePath:exe,headless:true,userDataDir:path.join(require('os').tmpdir(),'dmq-check-'+Date.now()),args:['--allow-file-access-from-files']});
 const pg=await b.newPage();await pg.setViewport({width:W,height:H});
 await pg.goto('file:///'+path.resolve(__dirname,'..',file).split(String.fromCharCode(92)).join('/')+'?t=0'+(vertical?'&v=1':''),{waitUntil:'networkidle0'});
 await pg.evaluate(()=>document.fonts.ready);
 fs.mkdirSync('/tmp/chk',{recursive:true});
 for(const t of times){
  await pg.evaluate(x=>window.dmqSeek(x),t);
  const m=await pg.evaluate(()=>{const o=[];document.querySelectorAll('.scene').forEach(s=>{if(parseFloat(s.style.opacity)>0.9){let top=1e9,bottom=-1e9,left=1e9,right=-1e9;[...s.children].forEach(k=>{if(parseFloat(k.style.opacity||1)<0.5)return;const r=k.getBoundingClientRect();top=Math.min(top,r.top);bottom=Math.max(bottom,r.bottom);left=Math.min(left,r.left);right=Math.max(right,r.right)});o.push({top:Math.round(top),bottom:Math.round(bottom),left:Math.round(left),right:Math.round(right)})}});return o});
  console.log(t,JSON.stringify(m));
  await pg.screenshot({path:'C:/Users/bavuk/AppData/Local/Temp/chk-'+(vertical?'v':'h')+'-'+t+'.png'});
 }
 await b.close();
})();
