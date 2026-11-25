/* Zhizhel Plachel's archive: all data stays in the ledger's local backup. */
(()=>{
'use strict';
const L=window.ZhizhelLedger;
if(!L)return;
const $=s=>document.querySelector(s);
const view=$('#archiveView');
const chapters=[
 ['book','Похоронная книга'],['dossiers','Архив компромата'],['tree','Паутина знакомств'],
 ['immortality','Проект «Бессмертие»'],['speeches','Книга надгробных речей'],
 ['letters','Письма Мире'],['board','Доска расследований'],['quests','Журнал заданий'],['chronicle','Хроника приключения']
];
const lists=['contacts','dossiers','immortality','letters','quests','chronicle','boardNodes','boardEdges','graphEdges','graphPositions','speechSaved'];
const arr=x=>Array.isArray(x)?x.filter(y=>y&&typeof y==='object'&&!Array.isArray(y)):[];
const normalize=x=>Object.fromEntries(lists.map(k=>[k,arr(x&&x[k])]));
let state=normalize(L.getArchive()),active='book',dossierId='',dossierSearch='',focusRecord='';
const filters={};
const uid=()=>globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():'a-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const str=x=>String(x??'');
const esc=x=>str(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=x=>esc(x);
const norm=x=>str(x).trim().toLocaleLowerCase('ru-RU');
const dateLabel=x=>{try{return new Date(x).toLocaleDateString('ru-RU')}catch(e){return ''}};
const statusNames={alive:'Жив',dead:'Мёртв',undead:'Нежить'};
// Ledger entries are read-only here. Contacts belong exclusively to the archive.
const ledgerPeople=()=>L.getPeople().map(p=>({...p,origin:'ledger'}));
const people=()=>{
 const originals=ledgerPeople(),ids=new Set(originals.map(p=>str(p.id)));
 return [...originals,...state.contacts.filter(p=>p.id!=null&&!ids.has(str(p.id))).map(p=>({...p,origin:'contact'}))];
};
const originLabel=p=>p?.origin==='ledger'?'Похоронная книга':'Знакомый';
const personCaption=p=>(statusNames[p?.status]||'Жив')+' · '+(p?.origin==='ledger'?'лист '+(p.pageIndex+1):'знакомый');
const personOptionLabel=p=>p.name+' · '+originLabel(p);
const personBy=id=>people().find(p=>str(p.id)===str(id));
const personName=id=>personBy(id)?.name||state.dossiers.find(d=>str(d.personId)===str(id))?.nameSnapshot||'Запись недоступна';
const row=(title,text)=>text?'<span class="arc-label">'+esc(title)+'</span><p class="hand">'+esc(text)+'</p>':'';
const tag=x=>'<span class="arc-tag">'+esc(x)+'</span>';
const act=(action,label,id='',cls='arc-small')=>'<button type="button" class="'+cls+'" data-arc="'+esc(action)+'" data-id="'+val(id)+'">'+esc(label)+'</button>';
const personLink=id=>id?'<p class="arc-ref">Связь: '+act('dossier',personName(id),id,'arc-link')+'</p>':'';
function persist(){const ok=L.setArchive(state);if(!ok)notify('Не удалось сохранить. Экспортируйте архив.');return ok}
let noticeTimer;
function notify(message){
 let box=$('#arcNotice');if(!box){box=document.createElement('div');box.id='arcNotice';box.className='arc-notice';box.setAttribute('role','status');document.body.append(box)}
 box.textContent=message;box.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>box.hidden=true,3200);
}
const shell=(className,kicker,title,desc,action,body)=>'<div class="arc-frame '+className+'"><div class="arc-heading"><div><div class="arc-kicker">'+esc(kicker)+'</div><h2>'+esc(title)+'</h2><p>'+esc(desc)+'</p></div>'+(action||'')+'</div>'+body+'</div>';
function switchChapter(chapter,options={}){
 if(!chapters.some(c=>c[0]===chapter))chapter='book';
 const old=active;active=chapter;
 if(options.person!==undefined)dossierId=str(options.person);
 if(options.record!==undefined)focusRecord=str(options.record);
 if(old!==chapter){const menu=$('#chapterMenu');if(menu)menu.open=false}
 $('#chapterName').textContent=chapters.find(c=>c[0]===chapter)[1];
 document.querySelectorAll('[data-chapter]').forEach(b=>{b.classList.toggle('active',b.dataset.chapter===chapter);if(b.dataset.chapter===chapter)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 $('#ledgerView').hidden=chapter!=='book';view.hidden=chapter==='book';
 if(chapter==='book'){L.refresh();return}
 render();
 if(options.scroll!==false&&old!==chapter)window.scrollTo({top:0,behavior:'instant'});
}
function render(){
 if(active==='dossiers')renderDossiers();
 else if(active==='speeches')renderSpeeches();
 else if(active==='tree'||active==='board')renderWorkspace(active);
 else if(['immortality','letters','quests','chronicle'].includes(active))renderRecords(active);
}
$('#chapterLinks').innerHTML=chapters.map(([id,name],i)=>'<button type="button" class="chapter-link'+(id==='book'?' active':'')+'" data-chapter="'+id+'"><span>'+String(i+1).padStart(2,'0')+'</span>'+esc(name)+'</button>').join('');
$('#chapterLinks').addEventListener('click',e=>{const b=e.target.closest('[data-chapter]');if(b)switchChapter(b.dataset.chapter)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-dossier]');if(b)visitDossier(b.dataset.dossier)});
window.addEventListener('ledger:change',()=>{if(active!=='book')render()});
window.addEventListener('archive:import',()=>{state=normalize(L.getArchive());dossierId='';workspace.tree.selected='';workspace.board.selected='';render();notify('Архив загружен')});
function openPerson(id){switchChapter('book');if(!L.openPerson(id))notify('Эта запись больше не находится в книге')}

/* One compact editor shared by chapters; chapter cards use different visual treatments. */
const modal=document.createElement('div');
modal.className='modal';modal.id='arcEditor';modal.hidden=true;
modal.innerHTML='<section class="arc-dialog" role="dialog" aria-modal="true" aria-labelledby="arcEditorTitle"><h2 id="arcEditorTitle"></h2><div id="arcEditorHelp"></div><form id="arcEditorForm"><div class="arc-dialog-grid" id="arcFields"></div><div class="arc-dialog-actions"><button type="button" class="arc-btn secondary" id="arcCancel">Отмена</button><button type="submit" class="arc-btn" id="arcSubmit">Сохранить</button></div></form></section>';
document.body.append(modal);
let editorCallback=null,editorFocus=null;
const F=(name,label,type='text',more={})=>({name,label,type,...more});
const O=(value,label=value)=>({value,label});
const personOptions=()=>[O('','— Не указан —'),...people().map(p=>O(str(p.id),personOptionLabel(p)))];
function optionMarkup(opts,value){return opts.map(o=>'<option value="'+val(o.value)+'"'+(str(o.value)===str(value)?' selected':'')+'>'+esc(o.label)+'</option>').join('')}
function relativeInput(value=''){
 return '<div class="arc-relative-row"><input name="relatives" value="'+val(value)+'" maxlength="120" placeholder="Имя — степень родства" aria-label="Родственник"><button type="button" class="arc-small" data-relative-remove aria-label="Удалить родственника">×</button></div>';
}
function fieldMarkup(field,initial){
 if(field.type==='relatives'){
  const items=Array.isArray(initial[field.name])?initial[field.name]:[];
  return '<fieldset class="arc-relative-field full"><legend>'+esc(field.label)+'</legend><div data-relative-list>'+ (items.length?items:['']).map(relativeInput).join('')+'</div><button type="button" class="arc-small" data-relative-add>＋ Добавить родственника</button></fieldset>';
 }
 const value=initial[field.name]??field.default??'';
 const attrs=' name="'+val(field.name)+'"'+(field.required?' required':'')+(field.placeholder?' placeholder="'+val(field.placeholder)+'"':'');
 let control;
 if(field.type==='select')control='<select'+attrs+'>'+optionMarkup(field.options||[],value)+'</select>';
 else if(field.type==='textarea')control='<textarea'+attrs+' maxlength="'+(field.max||16000)+'" rows="'+(field.rows||5)+'">'+esc(value)+'</textarea>';
 else if(field.type==='number')control='<input type="number"'+attrs+' min="'+(field.min??0)+'" max="'+(field.max??999)+'" step="1" value="'+val(value)+'">';
 else control='<input type="'+val(field.type||'text')+'"'+attrs+' maxlength="'+(field.max||250)+'" value="'+val(value)+'">';
 return '<label class="'+(field.full||field.type==='textarea'?'full':'')+'">'+esc(field.label)+control+'</label>';
}
function editForm(title,fields,initial,callback,help='',submit='Сохранить'){
 editorFocus=document.activeElement;
 $('#arcEditorTitle').textContent=title;$('#arcEditorHelp').innerHTML=help?'<p class="arc-help">'+esc(help)+'</p>':'';
 $('#arcFields').innerHTML=fields.map(f=>fieldMarkup(f,initial||{})).join('');
 $('#arcSubmit').textContent=submit;editorCallback=callback;modal.hidden=false;
 requestAnimationFrame(()=>{const el=$('#arcFields input, #arcFields textarea, #arcFields select');if(el)el.focus({preventScroll:true})});
}
function closeForm(){modal.hidden=true;editorCallback=null;if(editorFocus&&editorFocus.isConnected)editorFocus.focus({preventScroll:true});editorFocus=null}
$('#arcCancel').onclick=closeForm;
modal.addEventListener('click',e=>{
 if(e.target===modal){closeForm();return}
 const add=e.target.closest('[data-relative-add]'),remove=e.target.closest('[data-relative-remove]');
 if(add){
  const list=add.closest('.arc-relative-field').querySelector('[data-relative-list]');
  list.insertAdjacentHTML('beforeend',relativeInput());list.lastElementChild.querySelector('input').focus();
 }
 if(remove)remove.closest('.arc-relative-row').remove();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeForm()});
$('#arcEditorForm').onsubmit=e=>{
 e.preventDefault();if(!editorCallback)return;
 const formData=new FormData(e.target);
 const data=Object.fromEntries([...formData].map(([k,v])=>[k,str(v).trim()]));
 if(e.target.querySelector('[data-relative-list]'))data.relatives=formData.getAll('relatives').map(v=>str(v).trim()).filter(Boolean);
 const done=editorCallback(data);if(done!==false)closeForm();
};
function removeRecord(kind,id,label='запись'){
 if(!confirm('Удалить '+label+'?'))return;
 state[kind]=state[kind].filter(x=>str(x.id)!==str(id));persist();render();
}
function upsert(kind,id,data){
 const old=state[kind].find(x=>str(x.id)===str(id));
 if(old)Object.assign(old,data,{updatedAt:Date.now()});
 else state[kind].push({...data,id:uid(),createdAt:Date.now(),updatedAt:Date.now()});
 persist();
}
function textSearch(items,q,fields){q=norm(q);return q?items.filter(x=>fields.some(k=>norm(x[k]).includes(q))):items}

/* Contacts never insert or modify a funeral-book entry. */
const contactFields=()=>[
 F('name','Имя','text',{required:true,full:true,max:100}),
 F('age','Возраст','number',{min:0,max:999}),
 F('status','Состояние','select',{options:[O('alive','Жив'),O('dead','Мёртв'),O('undead','Нежить')],default:'alive'}),
 F('relatives','Родня','relatives',{full:true}),
 F('comment','Дополнительные заметки','textarea',{max:1200,rows:3})
];
function contactValues(data){
 return {name:str(data.name).trim(),age:str(data.age),status:['alive','dead','undead'].includes(data.status)?data.status:'alive',relatives:Array.isArray(data.relatives)?data.relatives:[],comment:str(data.comment)};
}
function checkContactName(data,id=''){
 if(!str(data.name).trim()){notify('Введите имя');return false}
 if(people().some(p=>str(p.id)!==str(id)&&norm(p.name)===norm(data.name)))return confirm('В архиве уже есть человек с таким именем. Сохранить как отдельного знакомого?');
 return true;
}
function createContact(data){
 const item={...contactValues(data),id:'contact-'+uid(),createdAt:Date.now(),updatedAt:Date.now()};
 state.contacts.push(item);return item;
}
function editContact(id='',defaults={}){
 const old=state.contacts.find(p=>str(p.id)===str(id));
 if(id&&!old){notify('Запись из похоронной книги изменяется только в самой книге');return}
 editForm(old?'Править знакомого':'Новый знакомый',contactFields(),old||defaults,data=>{
  if(!checkContactName(data,id))return false;
  let p;
  if(old){Object.assign(old,contactValues(data),{updatedAt:Date.now()});p=old;const d=dossierFor(old.id);if(d)d.nameSnapshot=p.name}
  else p=createContact(data);
  persist();workspace.tree.selected='p:'+p.id;
  switchChapter('tree',{scroll:false});requestAnimationFrame(()=>{if(active==='tree')selectNode('p:'+p.id,true)});
 },'Знакомый появится в паутине и списках архива. В похоронную книгу, её счётчики и доходы он не попадёт.');
}
function removeContact(id){
 const p=state.contacts.find(x=>str(x.id)===str(id));if(!p)return;
 const d=dossierFor(id);
 const message='Удалить знакомого «'+p.name+'» из паутины и справочника'+(d?' вместе с его досье':'')+'? Его ручные связи будут удалены. Связанные заметки других разделов сохранятся. Похоронная книга не изменится.';
 if(!confirm(message))return;
 const prefix='r:'+id+':',key='p:'+id;
 const belongs=x=>str(x)===key||str(x).startsWith(prefix);
 state.contacts=state.contacts.filter(x=>str(x.id)!==str(id));
 state.dossiers=state.dossiers.filter(x=>str(x.personId)!==str(id));
 state.graphEdges=state.graphEdges.filter(e=>!belongs(e.from)&&!belongs(e.to));
 state.graphPositions=state.graphPositions.filter(p=>!belongs(p.id));
 workspace.tree.selected='';persist();render();
}

/* Dossiers exist only after an explicit save. Both sources share stable person IDs. */
const certainty=[O('rumor','Слух / гипотеза'),O('observed','Личное наблюдение'),O('verified','Подтверждено'),O('disputed','Противоречивые сведения')];
const dossierFields=[
 F('secret','Тайны и компромат','textarea'),F('weakness','Слабости, страхи, желания','textarea'),F('leverage','Долги и возможные рычаги давления','textarea'),
 F('relationship','Отношение к Жижелю','text'),F('certainty','Достоверность','select',{options:certainty,default:'rumor'}),
 F('source','Источник сведений','textarea'),F('notes','Личные наблюдения','textarea')
];
const dossierFor=id=>state.dossiers.find(d=>str(d.personId)===str(id));
function dossierItems(){
 return state.dossiers.map(d=>{
  const id=str(d.personId),p=personBy(id);
  return {id,name:p?.name||d.nameSnapshot||'Утраченная запись',status:p?.status||'',p:p||null,d};
 });
}
function renderDossiers(){
 const all=dossierItems();
 if(!all.some(x=>x.id===dossierId))dossierId=all[0]?.id||'';
 view.innerHTML=shell('arc-dossier','Дело под печатью · только для себя','Архив компромата','Только дела, которые Жижель завёл лично. Новые знакомые не становятся досье автоматически.',act('new-dossier','＋ Завести досье','','arc-btn'),
 '<div class="arc-filters"><input id="dossierSearch" type="search" placeholder="Найти досье или тайну" value="'+val(dossierSearch)+'"></div><div class="dossier-layout"><div class="dossier-list" id="dossierTabs"></div><div id="dossierSheet"></div></div>');
 $('#dossierSearch').oninput=e=>{dossierSearch=e.target.value;paintDossiers()};
 paintDossiers();
}
function paintDossiers(){
 const all=dossierItems(),q=norm(dossierSearch);
 const filtered=all.filter(x=>!q||[x.name,x.p?.comment,x.d.secret,x.d.weakness,x.d.leverage,x.d.notes,x.d.source].some(v=>norm(v).includes(q)));
 if(!filtered.some(x=>x.id===dossierId))dossierId=filtered[0]?.id||'';
 $('#dossierTabs').innerHTML=filtered.length?filtered.map(x=>'<button type="button" class="dossier-tab '+(x.id===dossierId?'active':'')+'" data-arc="select-dossier" data-id="'+val(x.id)+'">'+esc(x.name)+'<small>'+esc(x.p?personCaption(x.p):'Исходная запись удалена')+'</small></button>').join(''):'';
 const item=filtered.find(x=>x.id===dossierId);
 if(!item){$('#dossierSheet').innerHTML='<div class="arc-empty">'+(all.length?'Совпадений нет.':'Ни одного дела. Заведи первое досье: выбери знакомого из списка или впиши новое имя.')+'</div>';return}
 const d=item.d,p=item.p;
 const fields=dossierFields.filter(f=>f.name!=='certainty').map(f=>'<div class="dossier-field"><span>'+esc(f.label)+'</span><p>'+esc(d[f.name]||'—')+'</p></div>').join('');
 $('#dossierSheet').innerHTML='<article class="dossier-sheet"><div class="dossier-stamp">КОНФИДЕНЦИАЛЬНО</div><h3>'+esc(item.name)+'</h3><p class="arc-caption">'+esc(p?personCaption(p)+(p.age!==''&&p.age!=null?' · возраст '+p.age:''):'Исходная запись удалена; досье сохранено')+'</p>'+tag(certainty.find(x=>x.value===d.certainty)?.label||'Достоверность не установлена')+
 (p&&p.comment?'<div class="dossier-field"><span>'+esc(p.origin==='ledger'?'Заметка из похоронной книги':'Заметка о знакомом')+'</span><p>'+esc(p.comment)+'</p></div>':'')+
 (p&&Array.isArray(p.relatives)&&p.relatives.length?'<div class="dossier-field"><span>Родня</span><p>'+p.relatives.map(esc).join(' · ')+'</p></div>':'')+
 '<div class="dossier-fields">'+fields+'</div><div class="arc-card-actions">'+act('edit-dossier','Править',item.id)+(p?(p.origin==='ledger'?act('open-person','Запись в книге',item.id):act('edit-contact','Править знакомого',item.id))+act('tree-person','Показать связи',item.id):'')+act('board-person','Прикрепить к доске',item.id)+act('remove-dossier','Удалить досье',d.id)+'</div></article>';
}
function visitDossier(id){
 id=str(id);
 if(!dossierFor(id)&&!personBy(id)){notify('Связанная запись недоступна');return}
 dossierSearch='';
 switchChapter('dossiers',{person:id});
 if(!dossierFor(id))editDossier(id);
}
function chooseDossier(){
 const options=[O('__new__','Вписать нового человека'),...people().map(p=>O(str(p.id),personOptionLabel(p)+(dossierFor(p.id)?' · досье уже есть':'')))];
 editForm('Завести досье',[F('person','На кого завести дело','select',{options,full:true,default:options.length>1?options[1].value:'__new__'})],{},data=>{
  if(data.person==='__new__'){newDossierContact();return false}
  if(!personBy(data.person)){notify('Человек не найден');return false}
  editDossier(data.person);return false;
 },'Можно выбрать человека из похоронной книги или паутины знакомств. Новое имя попадёт только в общий справочник и паутину.','Продолжить');
}
function newDossierContact(){
 editForm('Новое имя и досье',[...contactFields(),...dossierFields],{},data=>{
  if(!checkContactName(data))return false;
  const p=createContact(data),fields=Object.fromEntries(dossierFields.map(f=>[f.name,data[f.name]||'']));
  state.dossiers.push({...fields,id:uid(),personId:p.id,nameSnapshot:p.name,createdAt:Date.now(),updatedAt:Date.now()});
  persist();dossierSearch='';dossierId=p.id;renderDossiers();
 },'Досье и знакомый будут созданы одновременно. Ни одной записи в похоронной книге при этом не появится.');
}
function editDossier(id){
 id=str(id);const p=personBy(id),d=dossierFor(id);
 if(!p&&!d){notify('Человек не найден');return}
 const name=p?.name||d.nameSnapshot||'Утраченная запись';
 editForm((d?'Досье: ':'Завести досье: ')+name,dossierFields,d||{},data=>{
  upsert('dossiers',d?.id||'',{...data,personId:id,nameSnapshot:name});
  dossierId=id;dossierSearch='';renderDossiers();
 },'Досье появляется в архиве только после сохранения. Исходная запись и финансовый учёт не изменяются.');
}

/* The four written journals. */
const questStatuses=[O('active','В работе'),O('paused','Отложено'),O('done','Выполнено'),O('failed','Провалено')];
const immortalStatuses=[O('rumor','Слух'),O('study','Исследую'),O('verified','Подтверждено'),O('rejected','Опровергнуто')];
const immortalKinds=[O('method','Способ обрести бессмертие'),O('lead','Зацепка'),O('pact','Сделка / обещание'),O('question','Вопрос'),O('risk','Риск / цена'),O('person','Потенциальный союзник')];
const labelOf=(options,value)=>options.find(x=>x.value===value)?.label||str(value);
const configs={
 immortality:{className:'arc-immortal',kicker:'Запретный гримуар · личные записи',title:'Проект «Бессмертие»',desc:'Искать вечность, не отдавая себя в чужую собственность. Только то, что известно в вашей кампании.',add:'Новая гипотеза',singular:'запись',statuses:immortalStatuses,
 fields:()=>[F('title','Название','text',{required:true,full:true}),F('kind','Раздел','select',{options:immortalKinds,default:'method'}),F('status','Достоверность','select',{options:immortalStatuses,default:'rumor'}),F('person','Связанный человек','select',{options:personOptions(),full:true}),F('body','Что известно / гипотеза','textarea',{required:true}),F('source','Источник сведений','textarea',{rows:3}),F('cost','Цена, риски и условия','textarea',{rows:3}),F('next','Следующий шаг / вопрос','textarea',{rows:3})]},
 letters:{className:'arc-letters',kicker:'Личная переписка · письма без адресата',title:'Письма Мире',desc:'То, что Жижель никогда не скажет заказчику, можно оставить на бумаге.',add:'Написать письмо',singular:'письмо',
 fields:()=>[F('title','Название письма','text',{required:true,full:true,placeholder:'Например: Первый вечер в тумане'}),F('gameDate','Дата в мире','text'),F('session','Игровая сессия','text'),F('body','Мира, …','textarea',{required:true,rows:11})]},
 quests:{className:'arc-quests',kicker:'Доска поручений · дела и обещания',title:'Журнал заданий',desc:'Записывай, кто чего хочет, что обещано и какое действие предстоит.',add:'Новое поручение',singular:'поручение',statuses:questStatuses,
 fields:()=>[F('title','Название поручения','text',{required:true,full:true}),F('status','Состояние','select',{options:questStatuses,default:'active'}),F('priority','Важность','select',{options:[O('normal','Обычная'),O('urgent','Срочная'),O('low','Низкая')],default:'normal'}),F('person','Кто выдал поручение (из архива)','select',{options:personOptions(),full:true}),F('giver','Другой заказчик / место','text',{full:true}),F('reward','Обещанная награда','text',{full:true}),F('body','Задача и условия','textarea',{required:true}),F('next','Следующий шаг','textarea',{rows:3})]},
 chronicle:{className:'arc-chronicle',kicker:'Анналы странствий · по следам событий',title:'Хроника приключения',desc:'История только ваших сессий: события, решения, последствия и знакомые имена.',add:'Записать событие',singular:'событие',
 fields:()=>[F('title','Название события','text',{required:true,full:true}),F('session','Номер / название сессии','text'),F('gameDate','Дата в мире','text'),F('location','Место','text',{full:true}),F('person','Связанный человек','select',{options:personOptions(),full:true}),F('body','Что произошло','textarea',{required:true,rows:7}),F('consequences','Решения, последствия, открытые вопросы','textarea',{rows:4})]}
};
function editRecord(kind,id='',defaults={}){
 const cfg=configs[kind];if(!cfg)return;
 const old=state[kind].find(x=>str(x.id)===str(id));
 editForm(old?'Править: '+old.title:cfg.add,cfg.fields(),old||defaults,data=>{if(!data.title)return false;upsert(kind,id,data);focusRecord='';renderRecords(kind)});
}
function renderRecords(kind){
 const cfg=configs[kind],f=filters[kind]||(filters[kind]={q:'',status:''});
 const options=cfg.statuses?[O('','Все состояния'),...cfg.statuses]:[];
 view.innerHTML=shell(cfg.className,cfg.kicker,cfg.title,cfg.desc,act('new-record','＋ '+cfg.add,kind,'arc-btn'),
 '<div class="arc-filters"><input id="recordSearch" type="search" value="'+val(f.q)+'" placeholder="Поиск по записям">'+(options.length?'<select id="recordStatus" aria-label="Состояние">'+optionMarkup(options,f.status)+'</select>':'')+'</div><div id="recordList" class="arc-list'+(kind==='chronicle'?' chronicle-list':'')+'"></div>');
 $('#recordSearch').oninput=e=>{f.q=e.target.value;paintRecords(kind)};
 const st=$('#recordStatus');if(st)st.onchange=e=>{f.status=e.target.value;paintRecords(kind)};
 paintRecords(kind);
 if(focusRecord){const id=focusRecord;focusRecord='';requestAnimationFrame(()=>{const target=[...view.querySelectorAll('[data-record-id]')].find(x=>x.dataset.recordId===id);if(target)target.scrollIntoView({block:'center',behavior:'smooth'})})}
}
function paintRecords(kind){
 const cfg=configs[kind],f=filters[kind]||{};
 const items=textSearch(state[kind],f.q,['title','body','source','cost','next','giver','reward','location','gameDate','session','consequences']).filter(x=>!f.status||x.status===f.status);
 items.sort((a,b)=>kind==='chronicle'?(Number(a.createdAt)||0)-(Number(b.createdAt)||0):(Number(b.updatedAt||b.createdAt)||0)-(Number(a.updatedAt||a.createdAt)||0));
 $('#recordList').innerHTML=items.length?items.map(x=>recordCard(kind,x)).join(''):'<div class="arc-empty">'+(state[kind].length?'По этому фильтру ничего не найдено.':'Пока здесь нет записей. Первая строка — начало истории.')+'</div>';
}
function recordCard(kind,x){
 const id=val(x.id),actions='<div class="arc-card-actions">'+act('edit-record','Править',kind+':'+x.id)+act('pin-record','На доску',kind+':'+x.id)+act('remove-record','Удалить',kind+':'+x.id)+'</div>';
 if(kind==='letters')return '<article class="arc-card letter-sheet" data-record-id="'+id+'"><div class="arc-meta">'+esc([x.gameDate,x.session&&'Сессия '+x.session].filter(Boolean).join(' · ')||dateLabel(x.createdAt))+'</div><h3>'+esc(x.title)+'</h3><p class="hand">Мира,</p><p class="hand">'+esc(x.body)+'</p><div class="letter-signature">Твой Жижель</div>'+actions+'</article>';
 if(kind==='immortality')return '<article class="arc-card" data-record-id="'+id+'"><div class="arc-card-top"><div>'+tag(labelOf(immortalKinds,x.kind))+'<h3>'+esc(x.title)+'</h3></div>'+tag(labelOf(immortalStatuses,x.status))+'</div><p class="hand">'+esc(x.body)+'</p>'+personLink(x.person)+'<details><summary>Источники, цена и следующий шаг</summary>'+row('Источник',x.source)+row('Цена и риски',x.cost)+row('Следующий шаг',x.next)+(!x.source&&!x.cost&&!x.next?'<p class="arc-caption">Ещё не записаны.</p>':'')+'</details>'+actions+'</article>';
 if(kind==='quests')return '<article class="arc-card quest-slip" data-status="'+val(x.status)+'" data-record-id="'+id+'"><div class="arc-card-top"><div>'+tag(labelOf(questStatuses,x.status))+'<h3>'+esc(x.title)+'</h3></div>'+tag(x.priority==='urgent'?'Срочно':x.priority==='low'?'Не спешить':'Обычная')+'</div>'+personLink(x.person)+(x.giver?'<p class="arc-meta">Заказчик: '+esc(x.giver)+'</p>':'')+'<p class="hand">'+esc(x.body)+'</p>'+row('Награда',x.reward)+row('Следующий шаг',x.next)+'<details><summary>Действия с поручением</summary><div class="arc-card-actions">'+act('quest-status','Изменить состояние',x.id)+'</div>'+actions+'</details></article>';
 return '<article class="arc-card chronicle-event" data-record-id="'+id+'"><div class="arc-meta">'+esc([x.session&&'Сессия '+x.session,x.gameDate,x.location].filter(Boolean).join(' · ')||dateLabel(x.createdAt))+'</div><h3>'+esc(x.title)+'</h3><p class="hand">'+esc(x.body)+'</p>'+row('Последствия и решения',x.consequences)+personLink(x.person)+actions+'</article>';
}

/* Funeral oratory: 72 authored speeches plus saved personalized versions. */
const bank=Array.isArray(window.ZhizhelSpeeches)?window.ZhizhelSpeeches:[];
let speech={mood:'',query:'',id:bank[0]?.id||'',person:'',name:'',memory:'',personal:false};
const allSpeeches=()=>[...bank,...state.speechSaved.map(x=>({...x,mood:'Мои речи',personal:true}))];
function filteredSpeeches(){return allSpeeches().filter(s=>(!speech.mood||s.mood===speech.mood)&&(!speech.query||norm(s.title+' '+s.body).includes(norm(speech.query))))}
function renderSpeeches(){
 const moods=[O('','Все стили'),...[...new Set(bank.map(s=>s.mood))].map(m=>O(m)),O('Мои речи','Мои сохранённые речи')];
 view.innerHTML=shell('arc-speeches','Ремесло траурного слова','Книга надгробных речей',bank.length+' авторских речей для разных церемоний. Без сюжетных спойлеров; факты о покойном добавляете вы.',act('new-speech','＋ Своя речь','','arc-btn'),
 '<div class="speech-layout"><aside class="speech-index"><label>Стиль<select id="speechMood">'+optionMarkup(moods,speech.mood)+'</select></label><input id="speechQuery" type="search" placeholder="Найти речь" value="'+val(speech.query)+'"><button type="button" class="arc-btn secondary" data-arc="random-speech">Открыть случайную речь</button><div id="speechChoices" class="speech-list"></div><details class="speech-extra"><summary>Персонализация речи</summary><label>Человек из архива<select id="speechPerson">'+optionMarkup(personOptions(),speech.person)+'</select></label><label>Имя вручную<input id="speechName" value="'+val(speech.name)+'" placeholder="Имя покойного"></label><label>Личное воспоминание / дополнительная фраза<textarea id="speechMemory" rows="3" placeholder="Добавьте только известные факты">'+esc(speech.memory)+'</textarea></label></details></aside><article class="speech-page" id="speechPage"></article></div>');
 $('#speechMood').onchange=e=>{speech.mood=e.target.value;paintSpeeches()};
 $('#speechQuery').oninput=e=>{speech.query=e.target.value;paintSpeeches()};
 $('#speechPerson').onchange=e=>{speech.person=e.target.value;speech.name=personBy(speech.person)?.name||'';$('#speechName').value=speech.name;paintSpeechPage()};
 $('#speechName').oninput=e=>{speech.name=e.target.value;paintSpeechPage()};
 $('#speechMemory').oninput=e=>{speech.memory=e.target.value;paintSpeechPage()};
 paintSpeeches();
}
function paintSpeeches(){
 const all=filteredSpeeches();if(!all.some(s=>s.id===speech.id))speech.id=all[0]?.id||'';
 $('#speechChoices').innerHTML=all.length?all.map(s=>'<button type="button" class="speech-choice '+(speech.id===s.id?'active':'')+'" data-arc="select-speech" data-id="'+val(s.id)+'">'+esc(s.title)+'</button>').join(''):'<p class="arc-caption">Речей не найдено.</p>';
 paintSpeechPage();
}
function currentSpeech(){return allSpeeches().find(s=>str(s.id)===str(speech.id))}
function speechText(s){if(!s)return '';return str(s.body).replace(/\{name\}/g,()=>speech.name.trim()||'[имя]')+(speech.memory.trim()?'\n\n'+speech.memory.trim():'')}
function paintSpeechPage(){
 const s=currentSpeech();
 $('#speechPage').innerHTML=s?'<div class="speech-orn">❧</div><h3>'+esc(s.title)+'</h3><div class="arc-caption" style="text-align:center">'+esc(s.mood)+'</div><div class="speech-text">'+esc(speechText(s))+'</div><div class="arc-card-actions">'+act('copy-speech','Копировать',s.id)+act('save-speech',s.personal?'Править речь':'Сохранить свою версию',s.id)+(s.personal?act('delete-speech','Удалить',s.id):'')+'</div>':'<div class="arc-empty">Выберите речь из оглавления или создайте свою.</div>';
}
async function copyText(text){
 try{await navigator.clipboard.writeText(text);notify('Речь скопирована')}
 catch(err){const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.top='0';t.style.opacity='0';document.body.append(t);t.select();try{if(document.execCommand('copy'))notify('Речь скопирована');else throw Error()}catch(e){notify('Не удалось скопировать. Выделите текст вручную.')}finally{t.remove()}}
}
function saveSpeech(existing='',from=null){
 const old=state.speechSaved.find(s=>s.id===existing);
 const initial=old||{title:from?.title||'',body:from?speechText(from):''};
 editForm(old?'Править речь':'Своя надгробная речь',[F('title','Название','text',{required:true,full:true}),F('body','Текст речи','textarea',{required:true,rows:12})],initial,data=>{
  const id=old?.id||uid();if(old)Object.assign(old,data,{updatedAt:Date.now()});else state.speechSaved.push({...data,id,createdAt:Date.now()});persist();
  speech={mood:'Мои речи',query:'',id,person:'',name:'',memory:'',personal:true};renderSpeeches();
 },'Можно изменить любое слово перед сохранением. Речь останется в личном архиве.');
}

/* Shared source links for pinned evidence, with safe lookup after deletions. */
const sourceOptions=()=>{
 const result=[O('','— Без ссылки —')];
 people().forEach(p=>result.push(O('person:'+p.id,'Человек · '+p.name)));
 ['dossiers','immortality','quests','chronicle','letters'].forEach(k=>state[k].forEach(r=>result.push(O(k+':'+r.id,({dossiers:'Досье',immortality:'Бессмертие',quests:'Поручение',chronicle:'Событие',letters:'Письмо'})[k]+' · '+(r.title||r.nameSnapshot||personName(r.personId))))));
 return result;
};
function resolveSource(key){
 const [kind,...rest]=str(key).split(':'),id=rest.join(':');
 if(kind==='person'){const p=personBy(id);return p?{kind,id,title:p.name,body:p.comment||''}:null}
 if(!['dossiers','immortality','quests','chronicle','letters'].includes(kind))return null;
 const x=state[kind].find(r=>str(r.id)===id);if(!x)return null;
 if(kind==='dossiers')return {kind,id,person:x.personId,title:x.nameSnapshot||personName(x.personId),body:x.secret||x.notes||x.weakness||''};
 return {kind,id,title:x.title,body:x.body||''};
}
function openSource(key){
 const src=resolveSource(key);if(!src){notify('Связанная запись удалена или недоступна');return}
 if(src.kind==='person'){visitDossier(src.id);return}
 if(src.kind==='dossiers'){visitDossier(src.person);return}
 if(configs[src.kind]){filters[src.kind]={q:'',status:''};switchChapter(src.kind,{record:src.id})}
}

/* Interactive tree and cork board. Positions and edges are saved as data. */
const boardKinds=[O('clue','Улика'),O('person','Человек'),O('rumor','Слух'),O('place','Место'),O('event','Событие'),O('theory','Теория'),O('quest','Поручение'),O('note','Заметка')];
const relationTypes=[O('Родство'),O('Дружба'),O('Вражда'),O('Долг'),O('Деловая связь'),O('Союз'),O('Подозрение'),O('Другое')];
const workspace={tree:{zoom:0.85,selected:'',left:0,top:0,initialized:false},board:{zoom:0.85,selected:'',left:0,top:0,initialized:false}};
let sceneModel=null,sceneKind='';
function treeModel(){
 const all=people();
 const byName=new Map();
 all.forEach(p=>{const key=norm(p.name);if(!byName.has(key))byName.set(key,[]);byName.get(key).push(p)});
 const root={id:'root',title:'Жижель Плачель',subtitle:'Личный архив',kind:'root',w:166,h:76,x:0,y:45};
 const nodes=[root],edges=[],columns=[];
 all.forEach(p=>{
  const node={id:'p:'+p.id,title:p.name,subtitle:personCaption(p),kind:'person',origin:p.origin,personId:str(p.id),w:166,h:76,x:0,y:180};
  nodes.push(node);edges.push({from:'root',to:node.id,label:'',auto:true});
  const relatives=[],occurrences=new Map();
  for(const raw of Array.isArray(p.relatives)?p.relatives:[]){
   const s=str(raw).trim();if(!s)continue;
   const parts=s.split(/\s+[—–]\s+/);const name=parts.shift().trim(),label=parts.join(' — ').trim()||'родня';
   const matches=byName.get(norm(name))||[];
   if(matches.length===1&&str(matches[0].id)!==str(p.id)){edges.push({from:node.id,to:'p:'+matches[0].id,label,auto:true,family:true});continue}
   const key=norm(s),count=(occurrences.get(key)||0)+1;occurrences.set(key,count);
   const child={id:'r:'+p.id+':'+encodeURIComponent(key)+':'+count,title:name||s,subtitle:label,kind:'relative',ownerId:str(p.id),w:166,h:76,x:0,y:330};
   relatives.push(child);nodes.push(child);edges.push({from:node.id,to:child.id,label,auto:true,family:true});
  }
  columns.push({node,relatives,width:Math.max(220,relatives.length*190+30)});
 });
 const width=Math.max(800,columns.reduce((n,c)=>n+c.width,0)+60);
 let left=(width-columns.reduce((n,c)=>n+c.width,0))/2;
 root.x=width/2-root.w/2;
 columns.forEach(c=>{
  c.node.x=left+c.width/2-c.node.w/2;
  const span=c.relatives.length*190;
  c.relatives.forEach((r,i)=>r.x=left+c.width/2-span/2+i*190+12);
  left+=c.width;
 });
 const positions=new Map(state.graphPositions.map(p=>[str(p.id),p]));
 for(const n of nodes){const p=positions.get(n.id);if(p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))){n.x=Math.max(0,Number(p.x));n.y=Math.max(0,Number(p.y))}}
 const ids=new Set(nodes.map(n=>n.id));
 state.graphEdges.forEach(e=>{if(ids.has(str(e.from))&&ids.has(str(e.to)))edges.push({...e,auto:false})});
 return {nodes,edges,width:Math.max(width,...nodes.map(n=>n.x+n.w+40)),height:Math.max(510,...nodes.map(n=>n.y+n.h+50))};
}
function boardModel(){
 const nodes=state.boardNodes.map((p,i)=>({id:str(p.id),title:p.title||'Без названия',subtitle:p.body||'',kind:p.kind||'note',source:p.source||'',w:210,h:148,x:Number.isFinite(Number(p.x))&&p.x!=null?Math.max(0,Number(p.x)):50+(i%3)*260,y:Number.isFinite(Number(p.y))&&p.y!=null?Math.max(0,Number(p.y)):45+Math.floor(i/3)*205}));
 const ids=new Set(nodes.map(n=>n.id));
 return {nodes,edges:state.boardEdges.filter(e=>ids.has(str(e.from))&&ids.has(str(e.to))),width:Math.max(850,...nodes.map(n=>n.x+n.w+50)),height:Math.max(550,...nodes.map(n=>n.y+n.h+50))};
}
function renderWorkspace(kind){
 const w=workspace[kind],oldViewport=$('#workspaceViewport');
 if(sceneKind===kind&&oldViewport){w.left=oldViewport.scrollLeft;w.top=oldViewport.scrollTop}
 sceneKind=kind;
 const tree=kind==='tree';
 sceneModel=tree?treeModel():boardModel();
 if(!sceneModel.nodes.some(n=>n.id===w.selected))w.selected='';
 if(!w.selected&&tree)w.selected='root';
 const opts=[O('','Найти на '+(tree?'дереве':'доске')),...sceneModel.nodes.map(n=>O(n.id,n.title+' · '+(tree?(n.kind==='relative'?'родня':n.kind==='root'?'архив':n.origin==='ledger'?'из книги':'знакомый'):labelOf(boardKinds,n.kind))))];
 view.innerHTML=shell(tree?'arc-tree':'arc-board',tree?'Генеалогическое древо · сеть отношений':'Следственное дело · красная нить',tree?'Паутина знакомств':'Доска расследований',tree?'Добавляйте знакомых без оплаты и стройте отношения. Люди и родня из похоронной книги тоже отображаются здесь.':'Прикалывайте заметки, связывайте их красными нитями и меняйте расположение улик.',
 act(tree?'new-contact':'new-pin',tree?'＋ Знакомый':'＋ Улика','','arc-btn'),
 '<div class="workspace-bar"><select id="workspaceFind" aria-label="Найти узел">'+optionMarkup(opts,w.selected)+'</select><span class="zoom-control" id="zoomText" aria-label="Текущий масштаб">'+Math.round(w.zoom*100)+'%</span><details><summary>Инструменты</summary><div class="workspace-options">'+act('workspace-fit','Всё дерево / вся доска')+act('new-link','Добавить связь')+act('show-links','Список связей')+(tree?act('reset-tree','Вернуть исходную раскладку'):'')+'</div></details></div><p class="arc-caption">'+(tree?'Два пальца — масштаб, один — перемещение поля. Карточки двигайте за верхнюю полоску.':'Два пальца — масштаб, один — перемещение поля. Карточки двигайте за верхнюю полоску.')+'</p><div class="workspace-viewport" id="workspaceViewport"><div class="workspace-space" id="workspaceSpace"><div class="workspace-scene '+(tree?'tree-scene':'board-scene')+'" id="workspaceScene"><svg class="thread-svg" id="workspaceThreads" aria-hidden="true"></svg><div id="workspaceNodes"></div></div></div></div><div class="workspace-detail" id="workspaceDetail"></div>');
 const sc=$('#workspaceScene'),vp=$('#workspaceViewport');
 $('#workspaceFind').onchange=e=>{if(e.target.value)selectNode(e.target.value,true)};

 sc.style.width=sceneModel.width+'px';sc.style.height=sceneModel.height+'px';
 $('#workspaceNodes').innerHTML=sceneModel.nodes.map(n=>nodeHtml(kind,n,w.selected)).join('');
 if(!sceneModel.nodes.length)$('#workspaceNodes').innerHTML='<div style="padding:45px;color:#4a2d1b;font:22px var(--display)">Прикрепите первую улику.</div>';
 resizeWorkspace();paintThreads();paintWorkspaceDetail();
 attachWorkspaceGestures(vp);
 requestAnimationFrame(()=>{if(sceneKind!==kind||!vp.isConnected)return;if(!w.initialized){w.initialized=true;if(tree){const root=sceneModel.nodes.find(n=>n.id==='root');vp.scrollLeft=Math.max(0,(root.x+root.w/2)*w.zoom-vp.clientWidth/2)}}else{vp.scrollLeft=w.left;vp.scrollTop=w.top}});
}
function nodeHtml(kind,n,selected){
 const tree=kind==='tree',caption=tree?(n.kind==='root'?'архив':n.kind==='person'?(n.origin==='ledger'?'из книги':'знакомый'):'родня'):labelOf(boardKinds,n.kind);
 return '<div class="'+(tree?'tree-node '+n.kind:'board-pin')+(selected===n.id?' selected':'')+'" data-node="'+val(n.id)+'" data-kind="'+val(n.kind)+'" style="left:'+n.x+'px;top:'+n.y+'px"><div class="node-grip" data-grip="'+val(n.id)+'"><span>'+esc(caption)+'</span><span aria-hidden="true">⋮⋮</span></div><button type="button" class="node-body" data-arc="select-node" data-id="'+val(n.id)+'"><strong>'+esc(n.title)+'</strong><small>'+esc(n.subtitle)+'</small></button></div>';
}
function resizeWorkspace(){
 const w=workspace[sceneKind],space=$('#workspaceSpace'),sc=$('#workspaceScene'),svg=$('#workspaceThreads');
 if(!sc||!sceneModel||!w)return;
 sc.style.transform='scale('+w.zoom+')';space.style.width=Math.ceil(sceneModel.width*w.zoom)+'px';space.style.height=Math.ceil(sceneModel.height*w.zoom)+'px';
 svg.setAttribute('width',sceneModel.width);svg.setAttribute('height',sceneModel.height);svg.setAttribute('viewBox','0 0 '+sceneModel.width+' '+sceneModel.height);
 const zoom=$('#zoomText');if(zoom)zoom.textContent=Math.round(w.zoom*100)+'%';
}
function setZoom(value,keepCenter=true,anchor=null){
 const w=workspace[sceneKind],vp=$('#workspaceViewport');if(!w||!vp||!Number.isFinite(value))return;
 const a=anchor||{x:vp.clientWidth/2,y:vp.clientHeight/2};
 const wx=a.worldX??(vp.scrollLeft+a.x)/w.zoom,wy=a.worldY??(vp.scrollTop+a.y)/w.zoom;
 w.zoom=Math.max(.10,Math.min(3,value));resizeWorkspace();
 if(keepCenter){vp.scrollLeft=Math.max(0,wx*w.zoom-a.x);vp.scrollTop=Math.max(0,wy*w.zoom-a.y)}
}
function paintThreads(){
 const svg=$('#workspaceThreads');if(!svg||!sceneModel)return;
 const map=new Map(sceneModel.nodes.map(n=>[n.id,n]));
 svg.innerHTML=sceneModel.edges.map(e=>{
  const a=map.get(str(e.from)),b=map.get(str(e.to));if(!a||!b||a.id===b.id)return '';
  let ax=a.x+a.w/2,ay=a.y+a.h,bx=b.x+b.w/2,by=b.y;
  const tree=sceneKind==='tree';
  if(!tree||Math.abs(ay-by)<35){ay=a.y+a.h/2;by=b.y+b.h/2;ax=a.x+a.w/2;bx=b.x+b.w/2}
  if(tree&&by<ay&&Math.abs(by-ay)>35){ay=a.y;by=b.y+b.h}
  const mid=(ay+by)/2;
  const path=tree?'M '+ax+' '+ay+' C '+ax+' '+mid+', '+bx+' '+mid+', '+bx+' '+by:'M '+ax+' '+ay+' Q '+((ax+bx)/2)+' '+(((ay+by)/2)+14)+', '+bx+' '+by;
  const lines=tree?'<path class="'+(e.auto?'tree-thread':'manual-thread')+'" d="'+path+'"/>':'<path class="red-thread-shadow" d="'+path+'"/><path class="red-thread" d="'+path+'"/>';
  return lines+(e.label?'<text x="'+((ax+bx)/2)+'" y="'+(mid-5)+'" text-anchor="middle">'+esc(str(e.label).slice(0,45))+'</text>':'');
 }).join('');
}
function selectNode(id,center=false){
 const w=workspace[sceneKind],n=sceneModel?.nodes.find(n=>n.id===str(id));if(!w||!n)return;
 w.selected=n.id;
 document.querySelectorAll('#workspaceNodes [data-node]').forEach(el=>el.classList.toggle('selected',el.dataset.node===n.id));
 const find=$('#workspaceFind');if(find)find.value=n.id;
 paintWorkspaceDetail();
 if(center){const vp=$('#workspaceViewport');vp.scrollLeft=Math.max(0,(n.x+n.w/2)*w.zoom-vp.clientWidth/2);vp.scrollTop=Math.max(0,(n.y+n.h/2)*w.zoom-vp.clientHeight/2)}
}
function paintWorkspaceDetail(){
 const detail=$('#workspaceDetail');if(!detail||!sceneModel)return;
 const w=workspace[sceneKind],n=sceneModel.nodes.find(n=>n.id===w.selected);
 if(!n){detail.innerHTML='<p class="arc-caption">Выберите карточку, чтобы открыть её содержимое и связи.</p>';return}
 const tree=sceneKind==='tree';
 const linked=sceneModel.edges.filter(e=>str(e.from)===n.id||str(e.to)===n.id);
 const connections=linked.length?'<details><summary>Связи · '+linked.length+'</summary><div class="link-list">'+linked.map(e=>{
  const other=sceneModel.nodes.find(x=>x.id===(str(e.from)===n.id?str(e.to):str(e.from)));
  return '<div class="link-item"><span>'+act('jump-node',other?.title||'Недоступно',other?.id||'','arc-link')+(e.label?' · '+esc(e.label):'')+'</span>'+(!e.auto?act('edit-link','Править',e.id)+act('delete-link','Удалить',e.id):'<small>автоматически</small>')+'</div>';
 }).join('')+'</div></details>':'';
 let body='',actions=act('new-link','Связать',n.id);
 if(tree){
  if(n.kind==='person'){const p=personBy(n.personId),d=dossierFor(n.personId);body='<p class="arc-caption">'+esc(n.subtitle)+'</p>'+(p?.comment?'<p>'+esc(p.comment)+'</p>':'')+(d?.secret?'<p class="arc-caption">Компромат: '+esc(str(d.secret).slice(0,180))+'</p>':'');actions+=act('dossier',d?'Досье':'Завести досье',n.personId)+(p?.origin==='ledger'?act('open-person','Открыть в книге',n.personId):act('edit-contact','Править знакомого',n.personId)+act('remove-contact','Удалить знакомого',n.personId))+act('board-person','На доску',n.personId)}
  else if(n.kind==='relative'){body='<p>'+esc(n.subtitle)+' · родственник в записи '+esc(personName(n.ownerId))+'</p>';actions+=act('dossier','Досье основного человека',n.ownerId)}
  else body='<p>Корень личной сети. Линии обозначают знакомства Жижеля, а не доказанную дружбу или союз.</p>';
 }else{
  body='<p class="arc-caption">'+esc(labelOf(boardKinds,n.kind))+'</p><p class="hand">'+esc(n.subtitle||'Без заметки')+'</p>';
  if(n.source)body+='<p class="arc-ref">Источник: '+act('open-source',resolveSource(n.source)?.title||'Связанная запись недоступна',n.source,'arc-link')+'</p>';
  actions+=act('edit-pin','Править',n.id)+act('delete-pin','Удалить',n.id);
 }
 detail.innerHTML='<h3>'+esc(n.title)+'</h3>'+body+'<div class="arc-card-actions">'+actions+'</div>'+connections;
}
/* Direct manipulation: pinch about the fingers, pan the viewport, drag a grip.
   The workspace owns touch gestures; the rest of the page keeps normal scrolling. */
function pinchGeometry(a,b){
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
}
function attachWorkspaceGestures(vp){
 const kind=sceneKind,w=workspace[kind],pointers=new Map();
 let gesture=null,safariPinch=null,suppressClick=false;
 const local=(x,y)=>{const r=vp.getBoundingClientRect();return {x:x-r.left,y:y-r.top}};
 const coordinates=e=>local(e.clientX,e.clientY);
 const currentNode=id=>sceneModel?.nodes.find(n=>n.id===id);
 const nodeElement=id=>[...vp.querySelectorAll('[data-node]')].find(el=>el.dataset.node===id);
 function paintNode(n){
  const el=nodeElement(n.id);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px'}paintThreads();
 }
 function saveNode(n){
  if(kind==='tree'){
   state.graphPositions=state.graphPositions.filter(x=>str(x.id)!==n.id);
   state.graphPositions.push({id:n.id,x:n.x,y:n.y});
  }else{const p=state.boardNodes.find(p=>str(p.id)===n.id);if(p){p.x=n.x;p.y=n.y}}
  persist();
 }
 function restoreDrag(){
  if(gesture?.type!=='node'||!gesture.moved)return;
  const n=currentNode(gesture.id);if(n){n.x=gesture.x;n.y=gesture.y;paintNode(n)}
 }
 function beginPinch(){
  restoreDrag();
  const ids=[...pointers.keys()].slice(0,2),g=pinchGeometry(pointers.get(ids[0]),pointers.get(ids[1]));
  gesture={type:'pinch',ids,distance:g.distance,zoom:w.zoom,worldX:(vp.scrollLeft+g.x)/w.zoom,worldY:(vp.scrollTop+g.y)/w.zoom,moved:true};
  suppressClick=true;
 }
 function beginPan(id,p,tapId='',tap=true){
  gesture={type:'pan',pointer:id,startX:p.x,startY:p.y,left:vp.scrollLeft,top:vp.scrollTop,tapId,tap,moved:false};
 }
 vp.addEventListener('pointerdown',e=>{
  if(sceneKind!==kind||e.button>0)return;
  const p=coordinates(e);pointers.set(e.pointerId,p);
  try{vp.setPointerCapture(e.pointerId)}catch(err){}
  e.preventDefault();
  if(pointers.size>=2){if(pointers.size===2)beginPinch();return}
  suppressClick=false;
  const grip=e.target.closest('[data-grip]'),body=e.target.closest('[data-node]');
  const n=grip&&currentNode(grip.dataset.grip);
  if(n){
   selectNode(n.id);
   gesture={type:'node',pointer:e.pointerId,id:n.id,x:n.x,y:n.y,startX:p.x,startY:p.y,moved:false};
  }else beginPan(e.pointerId,p,body?.dataset.node||'');
 });
 vp.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId)||!gesture||sceneKind!==kind)return;
  const p=coordinates(e);pointers.set(e.pointerId,p);e.preventDefault();
  if(gesture.type==='pinch'){
   const a=pointers.get(gesture.ids[0]),b=pointers.get(gesture.ids[1]);if(!a||!b)return;
   const g=pinchGeometry(a,b);
   setZoom(gesture.zoom*g.distance/gesture.distance,true,{x:g.x,y:g.y,worldX:gesture.worldX,worldY:gesture.worldY});return;
  }
  if(gesture.pointer!==e.pointerId)return;
  const dx=p.x-gesture.startX,dy=p.y-gesture.startY;
  if(!gesture.moved&&Math.hypot(dx,dy)<4)return;
  gesture.moved=true;suppressClick=true;
  if(gesture.type==='pan'){
   vp.scrollLeft=gesture.left-dx;vp.scrollTop=gesture.top-dy;return;
  }
  const n=currentNode(gesture.id);if(!n)return;
  n.x=Math.max(5,Math.min(sceneModel.width-n.w-5,gesture.x+dx/w.zoom));
  n.y=Math.max(5,Math.min(sceneModel.height-n.h-5,gesture.y+dy/w.zoom));
  paintNode(n);
 });
 function finish(e){
  if(!pointers.has(e.pointerId))return;
  const g=gesture,cancel=e.type!=='pointerup';pointers.delete(e.pointerId);
  if(!g)return;
  if(g.type==='pinch'){
   if(pointers.size>=2){beginPinch();return}
   if(pointers.size===1){const [id,p]=pointers.entries().next().value;beginPan(id,p,'',false)}
   else gesture=null;
   return;
  }
  if(g.pointer!==e.pointerId)return;
  if(g.type==='node'&&g.moved){
   if(cancel)restoreDrag();else{const n=currentNode(g.id);if(n)saveNode(n)}
  }else if(g.type==='pan'&&!g.moved&&g.tap&&!cancel&&g.tapId)selectNode(g.tapId);
  gesture=null;
 }
 vp.addEventListener('pointerup',finish);vp.addEventListener('pointercancel',finish);vp.addEventListener('lostpointercapture',finish);
 vp.addEventListener('click',e=>{if(suppressClick&&e.detail!==0){e.preventDefault();e.stopPropagation();suppressClick=false}},true);
 // Wheel or trackpad pinch on a desktop, with the pointer as the zoom anchor.
 vp.addEventListener('wheel',e=>{
  e.preventDefault();if(e.shiftKey&&!e.ctrlKey&&!e.metaKey){vp.scrollLeft+=e.deltaY||e.deltaX;return}
  if(!e.ctrlKey&&!e.metaKey&&Math.abs(e.deltaX)>Math.abs(e.deltaY)){vp.scrollLeft+=e.deltaX;vp.scrollTop+=e.deltaY;return}
  const a=coordinates(e),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?vp.clientHeight:1);
  setZoom(w.zoom*Math.exp(-delta*.0025),true,a);
 },{passive:false});
 // WebKit also exposes native gesture events (e.g. Mac trackpad).
 vp.addEventListener('gesturestart',e=>{
  e.preventDefault();if(pointers.size>=2)return;
  const a=Number.isFinite(e.clientX)?coordinates(e):{x:vp.clientWidth/2,y:vp.clientHeight/2};
  safariPinch={zoom:w.zoom,worldX:(vp.scrollLeft+a.x)/w.zoom,worldY:(vp.scrollTop+a.y)/w.zoom,x:a.x,y:a.y};
 },{passive:false});
 vp.addEventListener('gesturechange',e=>{
  e.preventDefault();if(!safariPinch||pointers.size>=2)return;
  const a=Number.isFinite(e.clientX)?coordinates(e):safariPinch;
  setZoom(safariPinch.zoom*e.scale,true,{...a,worldX:safariPinch.worldX,worldY:safariPinch.worldY});
 },{passive:false});
 vp.addEventListener('gestureend',e=>{e.preventDefault();safariPinch=null},{passive:false});
}
function editPin(id='',defaults={}){
 const old=state.boardNodes.find(p=>str(p.id)===str(id));
 const options=sourceOptions();
 if(old?.source&&!options.some(o=>o.value===old.source))options.push(O(old.source,'Старая связь (запись недоступна)'));
 const fields=[F('title','Заголовок карточки','text',{required:true,full:true}),F('kind','Вид улики','select',{options:boardKinds,default:'clue'}),F('source','Связь с архивом','select',{options}),F('body','Содержание / наблюдение','textarea',{rows:6})];
 editForm(old?'Править улику':'Прикрепить улику',fields,old||defaults,data=>{
  if(old){Object.assign(old,data);workspace.board.selected=str(old.id)}
  else{const nodes=boardModel().nodes;let index=0,x,y;do{x=50+(index%3)*260;y=45+Math.floor(index/3)*205;index++}while(nodes.some(n=>x<n.x+n.w+15&&x+225>n.x&&y<n.y+n.h+15&&y+163>n.y));const item={...data,id:uid(),x,y,createdAt:Date.now()};state.boardNodes.push(item);workspace.board.selected=item.id}
  persist();switchChapter('board',{scroll:false});requestAnimationFrame(()=>{if(active==='board')selectNode(workspace.board.selected,true)});
 },'Карточки можно двигать по доске. Связь с архивом ведёт к исходной записи; содержание карточки остаётся самостоятельной заметкой.');
}
function pinSource(source){
 const resolved=resolveSource(source);if(!resolved){notify('Сначала создайте исходную запись');return}
 const old=state.boardNodes.find(n=>n.source===source);
 if(old){switchChapter('board');requestAnimationFrame(()=>{if(active==='board')selectNode(str(old.id),true)});return}
 const type=resolved.kind==='person'||resolved.kind==='dossiers'?'person':resolved.kind==='quests'?'quest':resolved.kind==='chronicle'?'event':'clue';
 editPin('',{title:resolved.title,kind:type,source,body:resolved.body});
}
function editLink(id='',from=''){
 if(!sceneModel||!['tree','board'].includes(active))return;
 const kind=active,list=kind==='tree'?'graphEdges':'boardEdges',old=state[list].find(e=>str(e.id)===str(id));
 const options=sceneModel.nodes.map(n=>O(n.id,n.title+(n.kind==='relative'?' · родня':'')));
 if(options.length<2){notify('Для связи нужны хотя бы две карточки');return}
 const initial=old||{from:from||workspace[kind].selected||options[0].value,to:options.find(o=>o.value!==(from||workspace[kind].selected||options[0].value))?.value,label:''};
 const types=[O('','Без подписи'),...relationTypes];
 if(old?.label&&!types.some(x=>x.value===old.label))types.push(O(old.label));
 const fields=[F('from','От карточки','select',{options,required:true}),F('to','К карточке','select',{options,required:true}),kind==='tree'?F('label','Тип связи','select',{options:types,full:true}):F('label','Подпись на красной нити','text',{full:true,placeholder:'Например: противоречит показаниям'}),F('note','Пояснение','textarea',{rows:3})];
 editForm(old?'Править связь':'Связать карточки',fields,initial,data=>{
  if(data.from===data.to){notify('Выберите две разные карточки');return false}
  if(state[list].some(e=>e.id!==id&&((e.from===data.from&&e.to===data.to)||(e.to===data.from&&e.from===data.to))&&e.label===data.label)){notify('Такая связь уже есть');return false}
  upsert(list,id,data);renderWorkspace(kind);
 },kind==='tree'?'Связи с родственниками из похоронной книги и справочника создаются автоматически. Здесь можно добавить любые подтверждённые или предполагаемые отношения.':'Красная нить связывает карточки. Подпись и пояснение можно изменить позднее.');
}
function showLinks(){
 const list=sceneKind==='tree'?'graphEdges':'boardEdges',model=sceneModel,manual=state[list];
 const name=id=>model.nodes.find(n=>n.id===str(id))?.title||'Удалённая запись';
 $('#workspaceDetail').innerHTML='<h3>'+ (sceneKind==='tree'?'Ручные связи':'Красные нити')+'</h3>'+(manual.length?'<div class="link-list">'+manual.map(e=>'<div class="link-item"><span>'+esc(name(e.from))+' — '+esc(name(e.to))+(e.label?' · '+esc(e.label):'')+(e.note?'<br><small>'+esc(e.note)+'</small>':'')+'</span>'+act('edit-link','Править',e.id)+act('delete-link','Удалить',e.id)+'</div>').join('')+'</div>':'<p class="arc-caption">Ручных связей пока нет.</p>')+'<div class="arc-card-actions">'+act('new-link','＋ Связь')+'</div>';
}
function deletePin(id){
 if(!confirm('Удалить карточку и все её красные нити? Исходная запись в архиве останется.'))return;
 state.boardNodes=state.boardNodes.filter(p=>str(p.id)!==str(id));state.boardEdges=state.boardEdges.filter(e=>str(e.from)!==str(id)&&str(e.to)!==str(id));
 workspace.board.selected='';persist();renderWorkspace('board');
}
function deleteLink(id){
 if(!confirm('Удалить эту связь?'))return;
 const list=sceneKind==='tree'?'graphEdges':'boardEdges';state[list]=state[list].filter(e=>str(e.id)!==str(id));persist();renderWorkspace(sceneKind);
}
function splitKey(key){const i=str(key).indexOf(':');return i<0?[key,'']:[key.slice(0,i),key.slice(i+1)]}
view.addEventListener('click',e=>{
 const button=e.target.closest('[data-arc]');if(!button)return;
 const a=button.dataset.arc,id=button.dataset.id||'';
 const [kind,recordId]=splitKey(id);
 switch(a){
 case 'chapter':switchChapter(id);break;
 case 'dossier':visitDossier(id);break;
 case 'new-dossier':chooseDossier();break;
 case 'new-contact':editContact();break;
 case 'edit-contact':editContact(id);break;
 case 'remove-contact':removeContact(id);break;
 case 'select-dossier':dossierId=id;paintDossiers();break;
 case 'edit-dossier':editDossier(id);break;
 case 'remove-dossier':removeRecord('dossiers',id,'досье');break;
 case 'open-person':openPerson(id);break;
 case 'tree-person':switchChapter('tree');requestAnimationFrame(()=>{if(active==='tree')selectNode('p:'+id,true)});break;
 case 'board-person':pinSource(dossierFor(id)?'dossiers:'+dossierFor(id).id:'person:'+id);break;
 case 'new-record':editRecord(id);break;
 case 'edit-record':editRecord(kind,recordId);break;
 case 'remove-record':if(configs[kind])removeRecord(kind,recordId,configs[kind].singular);break;
 case 'pin-record':pinSource(id);break;
 case 'quest-status':{const q=state.quests.find(x=>str(x.id)===id);if(q)editForm('Состояние поручения',[F('status','Состояние','select',{options:questStatuses,full:true})],q,d=>{upsert('quests',id,d);renderRecords('quests')});break}
 case 'select-speech':speech.id=id;paintSpeeches();break;
 case 'random-speech':{const all=filteredSpeeches().filter(s=>s.id!==speech.id);if(all.length){speech.id=all[Math.floor(Math.random()*all.length)].id;paintSpeeches()}else notify('В этом фильтре нет других речей');break}
 case 'copy-speech':copyText(speechText(currentSpeech()));break;
 case 'new-speech':saveSpeech();break;
 case 'save-speech':{const s=currentSpeech();if(s)saveSpeech(s.personal?s.id:'',s);break}
 case 'delete-speech':if(confirm('Удалить свою сохранённую речь?')){state.speechSaved=state.speechSaved.filter(s=>str(s.id)!==id);persist();renderSpeeches()}break;
 case 'select-node':case 'jump-node':selectNode(id,a==='jump-node');break;
 case 'new-pin':editPin();break;
 case 'edit-pin':editPin(id);break;
 case 'delete-pin':deletePin(id);break;
 case 'new-link':editLink('',id);break;
 case 'edit-link':editLink(id);break;
 case 'delete-link':deleteLink(id);break;
 case 'show-links':showLinks();break;
 case 'workspace-fit':{const vp=$('#workspaceViewport');setZoom(Math.min(vp.clientWidth/sceneModel.width,vp.clientHeight/sceneModel.height,1),false);vp.scrollLeft=vp.scrollTop=0;break}
 case 'reset-tree':if(confirm('Вернуть все узлы к исходной раскладке? Связи сохранятся.')){state.graphPositions=[];workspace.tree.initialized=false;persist();renderWorkspace('tree')}break;
 case 'open-source':openSource(id);break;
 }
});
switchChapter('book',{scroll:false});
})();