const fs=require('fs'), cp=require('child_process'), path=require('path');
const $=id=>document.getElementById(id), ctx=$('bitmap').getContext('2d');
const host=code=>new Promise(resolve=>window.__adobe_cep__.evalScript(code,resolve));
const root=decodeURI(window.__adobe_cep__.getSystemPath('extension')).replace(/^file:\/\/\/?/,'');
const english='Load selected bitmap|Select Region|Lasso|Smart Select|Replace|Add|Subtract|Object|Color|Edge|Preserve corners|Target color|Fill|Stroke|Vectorize|Cancel|Apply to Illustrator|Export SVG|Edge Threshold|Color Tolerance|Smoothness|Detail Level|Minimum Area|Select a bitmap in Illustrator.|Draw a region|Image decode failed|Processing ROI…|Cancelled|Python failed'.split('|');
const chinese='载入选中的位图|矩形框选|自由套索|智能选取|替换选区|添加选区|减去选区|物体提取|颜色提取|边缘检测|保留尖角|目标颜色|填充|描边|生成矢量|取消|应用到画板|导出 SVG|边缘阈值|颜色容差|平滑度|细节等级|最小面积|请在 Illustrator 中选中一张位图。|请在预览中选择区域|无法解码图片|正在处理选区…|已取消|Python 处理失败'.split('|');
const dictionary=new Map(english.map((key,i)=>[key,chinese[i]]));
let language=localStorage.getItem('slv.language')==='en'?'en':'zh';
let currentStatus=$('status').textContent;
function translate(text){
 if(language==='en')return text;
 if(dictionary.has(text))return dictionary.get(text);
 let count=/^Preview · (\d+) objects$/.exec(text);
 if(count)return '预览 · '+count[1]+' 个物体';
 count=/^Applied (\d+) objects$/.exec(text);
 if(count)return '已生成 '+count[1]+' 个物体';
 if(text.includes('Select one PNG/JPG'))return '请选择一张链接或嵌入的位图。';
 if(text.includes('Reload selected image')||text.includes('Reload moved raster'))return '请重新载入位图。';
 return text;
}
function statusLine(text){currentStatus=text;$('status').textContent=translate(text)}
let shapes=[],drag=null,results=[],worker,timer,seed=null,W=0,H=0;
for(const [id,label,value,max] of [['edge','Edge Threshold',60,255],['tol','Color Tolerance',25,255],['smooth','Smoothness',45,100],['detail','Detail Level',45,100],['minimum','Minimum Area',12,500]]){
 const row=document.createElement('label');row.innerHTML=label+' <span>'+value+'</span><input type="range" id="'+id+'" min="0" max="'+max+'" value="'+value+'">';
 $('params').appendChild(row);$(id).oninput=()=>{row.querySelector('span').textContent=$(id).value;schedule()};
}
function stop(){clearTimeout(timer);if(worker)worker.kill();worker=null;results=[];$('paths').innerHTML='';$('apply').disabled=$('save').disabled=true}
function schedule(){stop();timer=setTimeout(compute,250)}
function resize(){if(!W)return;const width=$('viewport').clientWidth*parseInt($('zoom').value)/100;$('stage').style.width=width+'px';$('stage').style.height=width*H/W+'px'}
$('zoom').onchange=resize;window.onresize=resize;
$('load').onclick=async()=>{stop();shapes=[];seed=null;W=0;draw();let file=await host('slvRead()');if(file.startsWith('ERROR'))return statusLine(file);
 const img=new Image();img.onload=()=>{W=img.width;H=img.height;$('bitmap').width=W;$('bitmap').height=H;ctx.drawImage(img,0,0);$('overlay').setAttribute('viewBox','0 0 '+W+' '+H);resize();statusLine('Draw a region')};img.onerror=()=>statusLine('Image decode failed');img.src='data:image/'+(/\.jpe?g$/i.test(file)?'jpeg':'png')+';base64,'+fs.readFileSync(file).toString('base64')};
function point(e){let b=$('overlay').getBoundingClientRect();return [Math.max(0,Math.min(W-1,Math.floor((e.clientX-b.left)*W/b.width))),Math.max(0,Math.min(H-1,Math.floor((e.clientY-b.top)*H/b.height)))]}
function draw(){let all=shapes.concat(drag?[drag]:[]);$('regions').innerHTML=all.map(s=>'<polygon class="roi" fill="'+(s.minus?'#fa565633':'#379aff38')+'" points="'+s.p.join(' ')+'"/>').join('')}
$('overlay').onpointerdown=e=>{if(!W)return;stop();let p=point(e);seed=null;if($('op').value==='Replace')shapes=[];
 if($('tool').value==='Smart Select'){let c=ctx.getImageData(...p,1,1).data;$('target').value='#'+Array.from(c.slice(0,3),n=>n.toString(16).padStart(2,'0')).join('');$('mode').value='Color';seed=p;shapes.push({p:[[0,0],[W,0],[W,H],[0,H]]});draw();schedule();return}
 drag={p:[p],minus:$('op').value==='Subtract'};$('overlay').setPointerCapture(e.pointerId);draw()};
$('overlay').onpointermove=e=>{if(!drag)return;let p=point(e),a=drag.p[0];if($('tool').value==='Lasso')drag.p.push(p);else drag.p=[a,[p[0],a[1]],p,[a[0],p[1]]];draw()};
$('overlay').onpointerup=()=>{if(!drag)return;if(drag.p.length>=3)shapes.push(drag);drag=null;draw();schedule()};
function compute(){stop();if(!shapes.length)return;let x=W,y=H,r=0,b=0;for(let s of shapes)for(let p of s.p){x=Math.min(x,p[0]);y=Math.min(y,p[1]);r=Math.max(r,p[0]);b=Math.max(b,p[1])}
 let w=Math.max(1,r-x),h=Math.max(1,b-y),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;let m=canvas.getContext('2d');m.translate(-x,-y);
 for(let s of shapes){m.globalCompositeOperation=s.minus?'destination-out':'source-over';m.beginPath();s.p.forEach(([a,b],i)=>i?m.lineTo(a,b):m.moveTo(a,b));m.fill()}
 let bytes=m.getImageData(0,0,w,h).data,mask=Buffer.alloc(w*h);for(let i=0;i<mask.length;i++)mask[i]=bytes[i*4+3];
 let cfg={origin:[x,y],shape:[h,w],rgba:Buffer.from(ctx.getImageData(x,y,w,h).data).toString('base64'),mask:mask.toString('base64'),mode:$('mode').value,color:$('target').value.slice(1).match(/../g).map(v=>parseInt(v,16)),corners:$('corners').checked,seed:seed&&[seed[0]-x,seed[1]-y]};
 for(let id of ['edge','tol','smooth','detail','minimum'])cfg[id]=+$(id).value;
 let p=worker=cp.spawn('python',[path.join(root,'engine.py')],{windowsHide:true});let out='',err='';statusLine('Processing ROI…');p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>err+=v);p.stdin.on('error',()=>{});p.on('error',e=>statusLine(e.message));p.on('close',code=>{if(worker!==p)return;worker=null;if(code)return statusLine(err||'Python failed');results=JSON.parse(out);$('paths').innerHTML=results.map(o=>'<path d="'+data(o)+'" fill="none" stroke="#67ffae" stroke-width="1.5" vector-effect="non-scaling-stroke"/>').join('');$('save').disabled=$('apply').disabled=!results.length;statusLine('Preview · '+results.length+' objects')});p.stdin.end(JSON.stringify(cfg))}
function data(obj){return obj.map(loop=>'M'+loop[0][0]+' '+loop.map(c=>'C'+c.slice(1).join(' ')).join(' ')+' Z').join(' ')}
$('run').onclick=compute;$('cancel').onclick=()=>{stop();statusLine('Cancelled')};for(const id of ['target','corners','mode'])$(id).onchange=schedule;
$('apply').onclick=async()=>statusLine(await host('slvApply('+[JSON.stringify(results),W,H,JSON.stringify($('fill').value),JSON.stringify($('outlined').checked?$('stroke').value:'')].join(',')+')'));
$('save').onclick=()=>{let f=window.cep.fs.showSaveDialogEx(translate('Export SVG'),'',['svg'],'selection.svg');if(f.data)fs.writeFileSync(f.data,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'">'+results.map(o=>'<path fill-rule="evenodd" fill="'+$('fill').value+'" stroke="'+($('outlined').checked?$('stroke').value:'none')+'" d="'+data(o)+'"/>').join('')+'</svg>')};



// Keep machine values stable when the visible option text changes.
document.querySelectorAll('option').forEach(option=>option.value=option.value);
const captions=[];
const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
while(walker.nextNode()){
 const node=walker.currentNode, key=node.nodeValue.trim();
 if(dictionary.has(key)&&node.parentElement.id!=='status')captions.push([node,key]);
}
function renderLanguage(){
 document.documentElement.lang=language==='en'?'en':'zh-CN';
 $('language').value=language;
 captions.forEach(([node,key])=>node.nodeValue=' '+translate(key)+' ');
 statusLine(currentStatus);
}
$('language').onchange=()=>{
 language=$('language').value;
 localStorage.setItem('slv.language',language);
 renderLanguage();
};
renderLanguage();
