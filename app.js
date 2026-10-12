/* ORBIT Lab. No demo accounts/data; database policies are the authority. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), root = $('orbit-lab');
  function setTheme(value){
    const theme=value==='light'?'light':'dark';root.dataset.theme=theme;
    document.documentElement.style.backgroundColor=theme==='light'?'#ffffff':'#050919';
    document.body.style.backgroundColor=theme==='light'?'#ffffff':'#050919';
    document.querySelector('meta[name="theme-color"]').content=theme==='light'?'#ffffff':'#050919';
    root.querySelectorAll('[data-theme-toggle]').forEach(b=>{b.textContent=theme==='light'?'Dark':'Light';b.setAttribute('aria-label',`Switch to ${theme==='light'?'dark':'light'} mode`);});
  }
  // Only the color preference is persistent. No account or research data here.
  try{setTheme(localStorage.getItem('orbit-color-theme'));}catch{setTheme('dark');}
  const names={home:'Overview',papers:'Papers',projects:'Projects',calendar:'Meeting Calendar',expenses:'Expenses',tasks:'Tasks & TA',signals:'Lab Lounge',members:'Members'};
  const glyphs={home:'◈',papers:'▤',projects:'◎',calendar:'▦',expenses:'◇',tasks:'☷',signals:'✦',members:'◉'};
  const tables=['members','projects','project_members','papers','expenses','tasks','calendar_slots','signals'];
  const emptyRows=()=>Object.fromEntries(tables.map(t=>[t,[]]));
  const S={session:null,me:null,rows:emptyRows(),directory:[],occupancy:[],commons:[],commonsError:'',layouts:{papers:'cards',projects:'cards',commons:'cards'},view:'home',filter:'active',busyMode:false,loading:0,ready:false,saving:false};
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const E=escape, faculty=()=>S.me?.role==='faculty'&&S.me.active, uid=()=>S.me?.id;
  const dateNow=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const addDays=(d,n)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
  const monday=d=>addDays(d,-((new Date(d+'T12:00:00Z').getUTCDay()+6)%7));
  S.week=monday(dateNow());
  const date=d=>d?new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}):'No deadline';
  const time=h=>{const m=Math.round(h*60);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
  const startMinutes=s=>s.start_hour*60+(s.start_minute??0);
  const duration=s=>s.duration_minutes??60;
  const covers=(s,d,m)=>s.slot_date===d&&startMinutes(s)<=m&&m<startMinutes(s)+duration(s);
  const repeatNames={weekly:'Weekly',biweekly:'Every 2 weeks',monthly:'Monthly (same date)'};
  function repeatDates(start,until,repeat){
    if(!start||!until||until<start||until>addDays(start,366))return [];
    const dates=[],weekday=d=>![0,6].includes(new Date(d+'T12:00:00Z').getUTCDay());
    if(repeat==='monthly'){
      const seed=new Date(start+'T12:00:00Z'),day=seed.getUTCDate();
      for(let i=0;i<=12;i++){const candidate=new Date(Date.UTC(seed.getUTCFullYear(),seed.getUTCMonth()+i,day,12));const d=candidate.toISOString().slice(0,10);if(candidate.getUTCDate()===day&&d>=start&&d<=until&&weekday(d))dates.push(d);}
    }else for(let d=start;d<=until;d=addDays(d,repeat==='biweekly'?14:7))if(weekday(d))dates.push(d);
    return dates;
  }
  const safeURL=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  const external=url=>safeURL(url)?`<a class="o-link" href="${E(safeURL(url))}" target="_blank" rel="noopener noreferrer">Open external link ↗</a>`:'';
  const person=id=>S.rows.members.find(m=>m.id===id)?.display_name||'Unassigned';
  const project=id=>S.rows.projects.find(p=>p.id===id);
  const inProject=id=>S.rows.project_members.some(m=>m.project_id===id&&m.member_id===uid());
  const taskParticipant=r=>(r.participant_ids||[]).includes(uid());
  const row=(type,id)=>S.rows[type]?.find(r=>r.id===id);
  const title=(type,r)=>type==='projects'?r.name:type==='expenses'?r.description:type==='calendar_slots'?r.topic||'Busy block':r.title;
  const archived=(type,r)=>Boolean(r.archived_at||(type==='papers'&&project(r.project_id)?.archived_at));
  const activeRows=type=>S.rows[type].filter(r=>!archived(type,r));
  const visibleRows=type=>S.rows[type].filter(r=>S.filter==='all'||(S.filter==='archived'?archived(type,r):!archived(type,r)));
  const editable=(type,r)=>!r.archived_at&&!r.cancelled_at&&(faculty()||
    (type==='projects'?inProject(r.id):type==='papers'?(r.owner_id===uid()||inProject(r.project_id)):type==='tasks'?(r.owner_id===uid()||taskParticipant(r)):r.owner_id===uid()));
  const canArchive=(type,r)=>faculty()||(['papers','tasks','signals'].includes(type)&&r.owner_id===uid());
  const button=(text,attrs='',primary=false)=>`<button type="button" class="o-btn ${primary?'primary':''}" ${attrs}>${text}</button>`;
  const badge=(text,color='purple')=>`<span class="o-badge ${color}">${E(text)}</span>`;
  const empty=text=>`<div class="o-empty">${E(text)}</div>`;
  const heading=(k,t,sub,actions='')=>`<div class="o-heading"><div><div class="o-kicker">${E(k)}</div><h1>${E(t)}</h1><p class="o-sub">${E(sub)}</p></div>${actions}</div>`;
  const filters=()=>`<div class="o-filters" aria-label="Record visibility">${['active','archived','all'].map(f=>button(f[0].toUpperCase()+f.slice(1),`data-filter="${f}" aria-pressed="${S.filter===f}"`)).join('')}</div>`;
  const input=(label,name,value='',type='text',attrs='')=>`<label class="o-field">${E(label)}<input name="${name}" type="${type}" value="${E(value)}" ${attrs}></label>`;
  const options=(values,selected)=>values.map(v=>{const [key,label]=Array.isArray(v)?v:[v,v];return `<option value="${E(key)}" ${String(selected??'')===String(key)?'selected':''}>${E(label)}</option>`;}).join('');
  const select=(label,name,values,selected,attrs='')=>`<label class="o-field">${E(label)}<select name="${name}" ${attrs}>${options(values,selected)}</select></label>`;
  const textarea=(label,name,value='')=>`<label class="o-field wide">${E(label)}<textarea name="${name}" maxlength="5000">${E(value)}</textarea></label>`;
  const people=(includeEmpty=false)=>[...(includeEmpty?[['','Unassigned']]:[]),...S.rows.members.map(m=>[m.id,m.display_name+(m.active?'':' · inactive')])];
  const formActions=(text='Save changes')=>`<div class="o-error" role="alert"></div><div class="o-dialog-actions">${button('Cancel','data-close')}<button type="submit" class="o-btn primary">${E(text)}</button></div>`;
  let db, authMode='login', needPassword=['recovery','invite'].includes(new URLSearchParams(location.hash.slice(1)).get('type'));
  let lastFocus, toastTimer, formContext=null;
  function errorText(error){
    if(['42703','PGRST204'].includes(error?.code)&&error?.message?.includes('participant_ids'))return 'Task participants need database update 009. Ask your faculty administrator to apply it, then refresh.';
    if(['23505','23P01'].includes(error?.code))return 'That time overlaps an existing meeting or busy block. Refresh the calendar and choose another time.';
    if(error?.code==='PGRST202'&&error?.message?.includes('orbit_availability_v2'))return 'The calendar database update is not installed yet. Ask your faculty administrator to apply migration 005, then retry.';
    if(error?.code==='PGRST202'&&error?.message?.includes('orbit_create_meeting_series'))return 'Recurring meetings need database update 006. Ask your faculty administrator to apply it before booking a series.';
    if(error?.code==='PGRST116')return 'This record changed or is no longer editable. Close this dialog and refresh.';
    if(error?.code==='42501')return 'You do not have permission for this action. Ask your faculty administrator if access needs to change.';
    return error?.message||'The request failed. Check your connection and try again.';
  }
  const unwrap=result=>{if(result.error)throw result.error;return result.data;};
  const rpc=async(name,args)=>unwrap(await db.rpc(name,args));
  function toast(text){$('o-toast').textContent=text;$('o-toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('o-toast').hidden=true,5000);}
  function close(){if(S.saving)return;$('o-overlay').hidden=true;$('workspace').inert=false;$('auth-screen').inert=false;formContext=null;if(lastFocus?.isConnected)lastFocus.focus();}
  function modal(name,html,context=null){lastFocus=document.activeElement;formContext=context;$('o-dialog-title').textContent=name;$('o-dialog-body').innerHTML=html;$('o-overlay').hidden=false;$('workspace').inert=true;$('auth-screen').inert=true;$('o-overlay').querySelector('[data-close]').focus();}
  function authScreen(mode='login',message=''){
    authMode=mode;$('workspace').hidden=true;$('auth-screen').hidden=false;
    $('auth-title').textContent={login:'Sign in',reset:'Reset your password',password:'Set your password',pending:'Membership pending',error:'Unable to load workspace'}[mode];
    $('auth-intro').textContent={login:'An invitation-only workspace for your research group.',reset:'We will email you a password reset link.',password:'Choose a new password for your ORBIT account.',pending:'Your login is valid, but your lab membership is not active. Ask your faculty administrator to activate it.',error:'Your data has not been loaded. Please retry or sign out.'}[mode];
    const formVisible=['login','reset','password'].includes(mode);
    $('auth-form').hidden=!formVisible;$('email-field').hidden=mode==='password';$('auth-email').required=mode!=='password';
    $('password-field').hidden=mode==='reset';$('auth-password').required=mode!=='reset';
    $('auth-password').autocomplete=mode==='password'?'new-password':'current-password';
    $('auth-password').minLength=mode==='password'?12:1;
    $('confirm-field').hidden=mode!=='password';$('auth-confirm').required=mode==='password';
    $('auth-password').value='';$('auth-confirm').value='';
    $('auth-submit').textContent={login:'Sign in →',reset:'Send reset link',password:'Save password'}[mode]||'Sign in';$('auth-submit').disabled=!db;
    $('forgot-password').hidden=mode!=='login';$('back-login').hidden=mode!=='reset';
    $('auth-signout').hidden=!S.session;$('auth-retry').hidden=!['pending','error'].includes(mode);
    $('auth-error').textContent=message;
    if(!formVisible&&message)$('auth-intro').textContent+=' '+message;
  }
  function clearWorkspace(){S.loading++;S.ready=false;S.me=null;S.rows=emptyRows();S.directory=[];S.occupancy=[];S.commons=[];S.commonsError='';S.layouts={papers:'cards',projects:'cards',commons:'cards'};$('o-content').innerHTML='';$('main-nav').innerHTML='';$('project-nav').innerHTML='';$('user-name').textContent='';$('user-role').textContent='';$('user-avatar').textContent='';$('o-dialog-body').innerHTML='';$('o-dialog-title').textContent='';$('o-toast').textContent='';$('o-toast').hidden=true;S.saving=false;close();}
  async function fetchCommons(){
    const rows=[];
    for(let offset=0;offset<20000;offset+=1000){
      const batch=await rpc('orbit_project_overview_v2',{p_offset:offset});
      if(!Array.isArray(batch))throw new Error('Project overview returned an invalid response.');
      rows.push(...batch);if(batch.length<1000)return {rows,error:''};
    }
    throw new Error('The project overview exceeds its list limit. Contact the administrator.');
  }
  async function fetchAll(type){
    const rows=[];
    for(let offset=0;offset<20000;offset+=1000){
      let q=db.from('orbit_'+type).select('*');
      q=type==='project_members'?q.order('project_id').order('member_id'):q.order('id');
      const batch=unwrap(await q.range(offset,offset+999));rows.push(...batch);
      if(batch.length<1000)return rows;
    }
    throw new Error('This workspace has exceeded the current list limit. Contact the administrator; no records were silently omitted.');
  }
  async function loadWorkspace({silent=false}={}){
    if(!S.session)return;
    const generation=++S.loading, userId=S.session.user.id;
    try{
      const me=unwrap(await db.from('orbit_members').select('*').eq('id',userId).maybeSingle());
      if(generation!==S.loading)return;
      if(!me?.active){clearWorkspace();S.me=me;authScreen('pending');return;}
      const [datasets,occ,directory,commons]=await Promise.all([
        Promise.all(tables.map(fetchAll)),rpc('orbit_availability_v2',{p_from:S.week,p_to:addDays(S.week,4)}),
        me.role==='faculty'?rpc('orbit_member_directory'):Promise.resolve([]),
        fetchCommons().catch(error=>({rows:[],error:error?.code==='PGRST202'?'Lab overview with member names needs database update 008. Your existing workspace is still available.':errorText(error)}))
      ]);
      if(generation!==S.loading||S.session?.user.id!==userId)return;
      S.me=me;S.rows=Object.fromEntries(tables.map((t,i)=>[t,datasets[i]]));S.occupancy=occ;S.directory=directory;S.commons=commons.rows;S.commonsError=commons.error;S.ready=true;
      if(needPassword){authScreen('password');return;}
      $('auth-screen').hidden=true;$('workspace').hidden=false;render();
      if(!silent)toast('Workspace is up to date.');
    }catch(error){if(generation!==S.loading)return;clearWorkspace();authScreen('error',errorText(error));}
  }
  function applyAuth(event,session){
    const previousId=S.session?.user.id;S.session=session;
    // signOut already cleared the screen; a queued duplicate callback must not
    // erase a password the user has started typing for their next sign-in.
    if(!session&&!previousId&&!S.ready&&event==='SIGNED_OUT'&&authMode==='login')return;
    if(!session){clearWorkspace();needPassword=false;authScreen();return;}
    if(event==='PASSWORD_RECOVERY')needPassword=true;
    if(needPassword){clearWorkspace();authScreen('password');return;}
    if(previousId===session.user.id&&S.ready&&['SIGNED_IN','TOKEN_REFRESHED'].includes(event))return;
    void loadWorkspace({silent:true});
  }
  async function signOut(){
    // Clear private DOM immediately, even if the remote sign-out request fails.
    clearWorkspace();S.session=null;needPassword=false;authScreen();
    const result=await db.auth.signOut({scope:'local'});if(result.error)toast('Workspace closed. Sign-out could not be confirmed; close this tab to clear its session.');
  }
  function lifecycle(type,r){
    let out='';
    if(canArchive(type,r))out+=button(r.archived_at?'Restore':'Archive',`data-life="${type}" data-id="${r.id}" data-archive="${!r.archived_at}"`);
    if(faculty()&&r.archived_at)out+=button('Delete permanently',`data-delete="${type}" data-id="${r.id}" data-danger`);
    return out;
  }
  function recordCard(type,r){
    let meta='',body='',state=r.status||r.kind||r.category||'';
    if(type==='projects'){
      meta=S.rows.project_members.filter(m=>m.project_id===r.id).map(m=>person(m.member_id)).join(', ')||'Faculty only';
      body=`<p>${E(r.research_question||'Research question not set yet.')}</p>`;
    }else if(type==='papers'){
      meta=`Owner: ${person(r.owner_id)} · ${date(r.target_date)}`;
      body=`<p>${E(project(r.project_id)?.name||'Independent paper')}</p><div class="o-handoff">With <strong>${E(r.external_holder||person(r.current_holder_id))}</strong> → Next <strong>${E(person(r.next_person_id))}</strong></div><p>${E(r.next_action)}</p>${external(r.link)}`;
    }else if(type==='expenses'){
      meta=`${person(r.owner_id)} · ${r.receipt_status}`;
      body=`<h3>${E(r.currency)} ${Number(r.amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</h3><p>${E(r.notes)}</p>${r.input_tokens!==null||r.output_tokens!==null?`<p>Tokens · Input ${E(r.input_tokens??'—')} / Output ${E(r.output_tokens??'—')}</p>`:''}${external(r.receipt_link)}`;
    }else if(type==='tasks'){
      meta=`Owner: ${person(r.owner_id)} · ${date(r.due_date)}`;state=r.done?'Completed':r.category;
      body=`<p class="o-task-participants"><span class="o-rq-label">Participants</span>${r.participant_ids?.length?r.participant_ids.map(id=>E(person(id))).join(' · '):'No additional participants.'}</p>`;
    }else{meta=person(r.owner_id);body=`<p>${E(r.notes)}</p>${external(r.link)}`;}
    const access=r.visibility?badge(r.visibility==='lab'?'Lab-wide':type==='expenses'?'Private':'Project members','blue'):type==='signals'?badge('Lab-wide','blue'):'';
    const parentArchived=type==='papers'&&project(r.project_id)?.archived_at;
    return `<article class="o-card"><div class="o-card-top">${badge(state||'In progress')}${r.archived_at?badge('Archived','warm'):parentArchived?badge('Project archived','warm'):''}</div><h3>${E(title(type,r))}</h3><div class="o-card-meta">${E(meta)}</div>${body}<div>${access}</div><div class="o-card-actions">${button(editable(type,r)?'Edit':'View details',`data-edit="${type}" data-id="${r.id}"`)}${type==='projects'&&faculty()&&!r.archived_at?button('Members',`data-project-members="${r.id}"`):''}${lifecycle(type,r)}</div></article>`;
  }
  function listView(type){
    const subtitles={papers:'Who owns it. Who has it. What happens next.',projects:'People, research questions, and the current state of the work.',expenses:'Amounts, receipt handoffs, token usage, and reimbursement progress.',tasks:'One owner, a shared effort, and a clear deadline. Visible to faculty, the owner, and assigned participants.',signals:'Good papers, useful tools, and small discoveries. Shared with all active lab members.'};
    const add={papers:'Add paper',projects:'New project',expenses:'Add expense',tasks:'Add task',signals:'Share something'};
    const records=visibleRows(type).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
    return heading('YZ LAB / RESEARCH WORKSPACE',names[type],subtitles[type],button('+ '+add[type],`data-edit="${type}" data-id="new"`,true))+(type==='projects'?commonsPanel()+'<h2 class="o-section-space">Your project workspace</h2><p class="o-sub">Details and editing remain limited to your existing permissions.</p>':'')+`<div class="o-view-toolbar">${filters()}${['papers','projects'].includes(type)?layoutToggle(type):''}</div>`+
      (records.length?collection(type,records):empty(S.filter==='archived'?'Nothing archived here.':'Nothing here yet. Add the first record when you are ready.'));
  }
  function layoutToggle(key){return `<div class="o-layout-toggle" role="group" aria-label="${key} display">${['cards','list'].map(mode=>button(mode==='cards'?'Cards':'List',`data-layout="${key}" data-mode="${mode}" aria-pressed="${S.layouts[key]===mode}"`)).join('')}</div>`;}
  function collection(type,records){return `<div class="o-collection ${S.layouts[type]==='list'?'o-record-list':'o-grid'}" data-collection="${type}">${records.map(r=>recordCard(type,r)).join('')}</div>`;}
  function commonsPanel(){
    return `<section class="o-commons" aria-labelledby="commons-title"><div class="o-panel-head"><div><div class="o-kicker">THE LAB AT A GLANCE</div><h2 id="commons-title">Our ongoing questions</h2></div>${layoutToggle('commons')}</div><p class="o-sub">Across YZ Lab · projects, members, research questions, and current stages. Read-only for everyone.</p>${S.commonsError?`<div class="o-note" role="status">${E(S.commonsError)}</div>`:S.commons.length?`<div class="o-collection ${S.layouts.commons==='list'?'o-record-list':'o-grid'}" data-collection="commons">${S.commons.map((p,i)=>`<article class="o-card o-summary-card"><div class="o-card-top"><span class="o-index">${String(i+1).padStart(2,'0')}</span>${badge(p.status)}</div><h3>${E(p.name)}</h3><p class="o-summary-members"><span class="o-rq-label">Members</span>${p.member_names?.length?p.member_names.map(E).join(' · '):'No active members assigned.'}</p><p><span class="o-rq-label">RQ</span>${E(p.research_question||'Research question to be added.')}</p></article>`).join('')}</div>`:empty('No ongoing projects yet.')}</section>`;
  }
  function home(){
    const papers=activeRows('papers').filter(p=>p.current_holder_id===uid());
    const tasks=activeRows('tasks').filter(t=>!t.done&&(faculty()||t.owner_id===uid()||taskParticipant(t))).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
    const upcoming=S.rows.calendar_slots.filter(s=>s.kind==='meeting'&&!s.cancelled_at&&s.slot_date>=dateNow()).sort((a,b)=>(a.slot_date+time(startMinutes(a)/60)).localeCompare(b.slot_date+time(startMinutes(b)/60))).slice(0,2);
    return heading('ORBIT / YZ LAB',`Welcome back, ${S.me.display_name}.`,'Good taste, shared context, research in motion.',button('+ New task','data-edit="tasks" data-id="new"',true))+
      `<div class="o-stat-grid"><div class="o-stat"><strong>${S.commonsError?'—':S.commons.length}</strong><span>Ongoing projects across YZ Lab</span></div><div class="o-stat"><strong>${papers.length}</strong><span>Papers on your desk</span></div><div class="o-stat"><strong>${tasks.length}</strong><span>Open tasks</span></div></div>${commonsPanel()}<div class="o-layout o-section-space"><div class="o-stack"><section><div class="o-panel-head"><h2>On your desk</h2>${layoutToggle('papers')}${button('All papers ↗','data-view="papers"')}</div>${papers.length?collection('papers',papers.slice(0,4)):empty('Nothing waiting on you right now.')}</section><section><div class="o-panel-head"><h2>Your projects</h2>${layoutToggle('projects')}${button('All projects ↗','data-view="projects"')}</div>${activeRows('projects').length?collection('projects',activeRows('projects').slice(0,4)):empty('Your next research question starts here.')}</section></div><div class="o-stack"><section><div class="o-panel-head"><h2>Next on the calendar</h2></div>${upcoming.map(meetingCard).join('')||empty('No upcoming meetings or personal schedules.')}<div class="o-section-space">${button('Open calendar →','data-view="calendar"')}</div></section><section><div class="o-panel-head"><h2>Coming up</h2></div><div class="o-stack">${tasks.slice(0,2).map(t=>recordCard('tasks',t)).join('')||empty('All caught up.')}</div></section></div></div>`;
  }
  function meetingCard(s){return `<article class="o-card"><div class="o-card-top">${badge(s.cancelled_at?'Cancelled':duration(s)+' min',s.cancelled_at?'warm':'purple')}${s.series_id?badge(repeatNames[s.repeat_rule]||'Recurring','blue'):''}</div><h3>${E(s.topic||'Busy block')}</h3><div class="o-card-meta">${E(date(s.slot_date))} · ${time(startMinutes(s)/60)}–${time((startMinutes(s)+duration(s))/60)} · ${E(person(s.owner_id))}</div><p>${E(s.location)}${s.notes?' · '+E(s.notes):''}</p>${s.series_id?`<p>Series ends ${E(s.repeat_until)} · Changes apply to this occurrence only.</p>`:''}<div class="o-card-actions">${s.cancelled_at?(faculty()?button('Delete permanently',`data-delete="meetings" data-id="${s.id}"`):''):button('Manage','data-booking="'+s.id+'"')}</div></article>`;}
  function calendar(){
    const days=Array.from({length:5},(_,i)=>addDays(S.week,i));
    const records=S.rows.calendar_slots.filter(s=>s.kind==='meeting'&&(S.filter==='archived'?!!s.cancelled_at:!s.cancelled_at)&&days.includes(s.slot_date));
    return heading('MAKE TIME FOR GOOD QUESTIONS.','Meeting Calendar','Monday–Friday · 09:00–17:00 · 30-minute slots · Asia/Shanghai',faculty()?button('+ Personal schedule','data-personal-schedule',true):'')+
      `<div class="o-toolbar">${button('←','data-week="-7" aria-label="Previous week"')}<strong>${date(days[0])}–${date(days[4])}, ${days[0].slice(0,4)}</strong>${button('→','data-week="7" aria-label="Next week"')}${button('This week','data-this-week')}${faculty()?button(S.busyMode?'Done editing availability':'Edit availability','data-busy-mode',S.busyMode):''}</div><div class="o-note">${S.busyMode?'Click an open slot to mark 30 minutes busy. Click a busy slot to reopen its entire block.':'Choose an available time. Meetings default to 30 minutes; 1 hour is also available. Other students’ meeting details stay private.'}</div><div class="o-week-grid">${days.map(d=>`<section class="o-day"><div class="o-day-title">${new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'})}<span>${date(d)}</span></div>${Array.from({length:16},(_,i)=>{
      const m=9*60+i*30,occ=S.occupancy.find(x=>covers(x,d,m)),own=S.rows.calendar_slots.find(x=>!x.cancelled_at&&covers(x,d,m));
      const disabled=!!occ&&!(own&&(faculty()||own.owner_id===uid()));
      return `<button class="o-slot ${occ?(occ.kind==='busy'?'busy':'booked'):''}" data-slot="${d}/${m}" ${disabled?'disabled':''}><span>${time(m/60)}</span><small>${occ?(occ.kind==='busy'?'Busy':own?E(person(own.owner_id)):'Booked'):'Available'}</small></button>`;
    }).join('')}</section>`).join('')}</div><div class="o-section-space"><div class="o-filters">${button('Scheduled','data-filter="active" aria-pressed="'+(S.filter!=='archived')+'"')}${button('Cancelled history','data-filter="archived" aria-pressed="'+(S.filter==='archived')+'"')}</div><div class="o-grid">${records.map(meetingCard).join('')||empty('No meetings in this view for the selected week.')}</div></div>`;
  }
  function members(){return heading('PEOPLE, NOT PERMISSIONS GUESSWORK.','Members','Names and roles are separate from login credentials.',button('+ Activate student','data-activate',true))+`<div class="o-note">Create or invite the student’s account in Supabase Authentication first. Once the email is confirmed, activate membership here. This button does not send an invitation email.</div><div class="o-grid">${S.directory.map(m=>`<article class="o-card"><div class="o-card-top">${badge(m.role==='faculty'?'Faculty':'Student')}${badge(m.active?'Active':'Inactive',m.active?'green':'warm')}</div><h3>${E(m.display_name)}</h3><p>${E(m.email)}</p>${m.role==='student'?button(m.active?'Revoke access':'Reactivate',`data-member-state="${m.id}" data-active="${!m.active}"`):'<p>Full workspace access</p>'}</article>`).join('')}</div>`;}
  function render(){
    if(!S.ready||!S.me)return;
    if(S.view==='members'&&!faculty())S.view='home';
    $('main-nav').innerHTML=Object.entries(names).filter(([k])=>k!=='members'||faculty()).map(([k,n])=>`<button data-view="${k}" ${S.view===k?'aria-current="page"':''}><span aria-hidden="true">${glyphs[k]}</span>${E(n)}</button>`).join('');
    $('project-nav').innerHTML='<div class="o-side-label">IN ORBIT</div>'+activeRows('projects').slice(0,5).map(p=>`<button class="o-text-btn o-side-project" data-edit="projects" data-id="${p.id}"><span class="o-dot"></span>${E(p.name)}</button>`).join('');
    $('user-name').textContent=S.me.display_name;$('user-avatar').textContent=S.me.display_name.slice(0,2).toUpperCase();$('user-role').textContent=faculty()?'Faculty · Full access':'Student · Member access';$('crumb').textContent=names[S.view];
    $('o-content').innerHTML=(S.view==='home'?home():S.view==='calendar'?calendar():S.view==='members'?members():listView(S.view))+`<div class="o-footer"><span>Open Research on Behavior, Intelligence &amp; Technology</span><span>Links &amp; handoffs. No uploads.</span></div>`;
  }
  function recordForm(type,id){
    if(!['projects','papers','expenses','tasks','signals'].includes(type))return;
    const old=id==='new'?null:row(type,id);if(id!=='new'&&!old)return;
    const r=old||{owner_id:uid(),visibility:type==='expenses'?'private':'members'},can=!old||editable(type,old),isFaculty=faculty();
    const owner=select('Owner','owner_id',people(),r.owner_id,'required '+(isFaculty?'':'disabled'));
    const visibility=select(type==='projects'?'Detail visibility':'Visibility','visibility',[[type==='expenses'?'private':'members',type==='expenses'?'Submitter + faculty':'Project members'],['lab','Lab-wide']],r.visibility,(type==='expenses'||isFaculty)?'':'disabled');
    let fields='';
    if(type==='projects')fields=input('Project name','name',r.name,'text','required maxlength="200"')+select('Current status','status',['Planning','Exploring','Experiment design','Data collection','Empirical analysis','Manuscript revision','Completed'],r.status||'Exploring')+textarea('Research question','research_question',r.research_question)+visibility+'<p class="o-note wide">Ongoing project names, active member names, research questions, and stages appear in the read-only lab overview for all active members. Detail visibility does not hide these four summary fields. Completed or archived projects leave the overview.</p>';
    if(type==='papers'){
      const projects=S.rows.projects.filter(p=>(!p.archived_at&&(isFaculty||inProject(p.id)))||p.id===r.project_id);
      fields=input('Paper title','title',r.title,'text','required maxlength="300"')+owner+select('Project','project_id',[['','Independent paper'],...projects.map(p=>[p.id,p.name])],r.project_id,old&&!isFaculty?'disabled':'')+
        select('Status','status',['Draft','Revision','Ready to submit','Submitted'],r.status||'Draft')+select('Currently with','holder',[...people(true),['journal','Journal']],r.external_holder?'journal':old?(r.current_holder_id||''):uid())+select('Next person','next_person_id',people(true),r.next_person_id)+input('Target deadline','target_date',r.target_date,'date')+visibility+select('Material handoff','handoff',['Link pending','Link provided','Shared offline'],r.handoff||'Link pending')+input('Document link (optional)','link',r.link,'url','placeholder="https://..."')+textarea('Next action','next_action',r.next_action);
    }
    if(type==='expenses')fields=input('Expense','description',r.description,'text','required maxlength="300"')+owner+input('Amount (CNY)','amount',r.amount,'number','required min="0.01" step="0.01"')+select('Progress','status',['To submit','Awaiting approval','Needs documents','With finance','Paid'],r.status||'To submit',isFaculty?'':'disabled')+select('Receipt handoff','receipt_status',['Pending','Link pending','Link provided','Delivered offline'],r.receipt_status||'Pending')+visibility+input('Receipt link (optional)','receipt_link',r.receipt_link,'url','placeholder="https://..."')+input('Input tokens (optional)','input_tokens',r.input_tokens,'number','min="0" step="1"')+input('Output tokens (optional)','output_tokens',r.output_tokens,'number','min="0" step="1"')+textarea('Notes','notes',r.notes);
    if(type==='tasks'){
      const progressOnly=old&&!isFaculty&&r.owner_id!==uid(),locked=progressOnly?'disabled':'';
      const candidates=S.rows.members.filter(m=>(m.active&&m.role==='student')||(r.participant_ids||[]).includes(m.id));
      const taskOwner=select('Owner','owner_id',S.rows.members.filter(m=>m.active||m.id===r.owner_id).map(m=>[m.id,m.display_name+(m.active?'':' · inactive')]),r.owner_id,'required '+(isFaculty?'':'disabled'));
      fields=input('Task','title',r.title,'text',`required maxlength="300" ${locked}`)+taskOwner+input('Deadline','due_date',r.due_date,'date',locked)+select('Category','category',['Admin','Teaching','Lab meeting'],r.category||'Admin',locked)+
        `<fieldset class="o-task-assignees wide" ${isFaculty?'':'disabled'}><legend>Participants</legend><div class="o-members-list">${candidates.map(m=>`<label class="o-member-check"><input type="checkbox" name="participant_ids" value="${E(m.id)}" ${(r.participant_ids||[]).includes(m.id)?'checked':''}>${E(m.display_name)}${m.active?'':' · inactive'}</label>`).join('')||'<p>No active students to assign yet.</p>'}</div></fieldset><p class="o-note wide">${isFaculty?'Select any number of students. The owner already has access and is not duplicated in the participant list.':'Only faculty can change the owner or participants.'} ${progressOnly?'You can update completion; the owner manages the task details.':'Participants can view this task and update completion.'}</p>`+
        `<label class="o-checkbox-label"><input name="done" type="checkbox" ${r.done?'checked':''}>Completed</label>`;
    }
    if(type==='signals')fields=input('Title','title',r.title,'text','required maxlength="300"')+select('Category','kind',['Paper pick','Interesting find','Tool','Small win'],r.kind||'Paper pick')+input('External link (optional)','link',r.link,'url')+textarea('Why it is worth sharing','notes',r.notes)+'<p class="o-note wide">Visible to all active lab members. Only the author and faculty can edit this post.</p>';
    modal(old?(can?'Edit ':'View ')+names[type]:`New ${names[type]}`,`<form data-form="record"><fieldset ${can?'':'disabled'}><div class="o-fields">${fields}</div></fieldset>${!can?'<p class="o-feedback">This record is read-only. Archived records must be restored before editing.</p>':''}${can?formActions():`<div class="o-dialog-actions">${button('Close','data-close')}</div>`}</form>`,{type,old});
  }
  function bookingForm(id,d,h,personal=false){
    const old=id?row('calendar_slots',id):null;if(id&&!old)return;
    if(old?.cancelled_at)return;
    const students=S.rows.members.filter(m=>m.active&&m.role==='student');
    const r=old||{slot_date:d,start_hour:Math.floor(h/60),start_minute:h%60,duration_minutes:30,owner_id:faculty()&&!personal?(students[0]?.id||uid()):uid(),location:'Office'};
    const owners=faculty()?S.rows.members.filter(m=>m.active||m.id===r.owner_id).map(m=>[m.id,m.role==='faculty'?`Personal schedule · ${m.display_name} (no students)`:m.display_name]):[[uid(),person(uid())]];
    modal(old?'Manage meeting / schedule':personal?'Personal schedule':'Book a meeting',`<form data-form="booking"><div class="o-fields">${input('Discussion topic / schedule title','topic',r.topic,'text','required maxlength="300"')}${select('Schedule for','owner_id',owners,r.owner_id,'required')}${input('Date','slot_date',r.slot_date,'date','required')}${select('Start time','start_minutes',Array.from({length:16},(_,i)=>[540+i*30,time(9+i/2)]),startMinutes(r))}${select('Duration','duration_minutes',[[30,'30 minutes'],[60,'1 hour']],duration(r))}${input('Location / format','location',r.location,'text','maxlength="200"')}${!old?select('Repeat','repeat_rule',[['none','Does not repeat'],...Object.entries(repeatNames)],personal?'weekly':'none')+input('Repeat until (required; within 1 year)','repeat_until','','date','disabled'):''}${textarea('Notes / meeting link','notes',r.notes)}</div><p class="o-feedback" id="booking-summary" aria-live="polite"></p>${!old?'<div id="repeat-preview" class="o-note" hidden></div>':r.series_id?`<p class="o-note">${E(repeatNames[r.repeat_rule])} · ends ${E(r.repeat_until)}. Edits affect this occurrence only. To change the series, cancel its future occurrences and create a new series.</p>`:''}${faculty()?'<p class="o-note">Personal schedules do not need a student. Students see only occupied time, never the title, location, or notes. These slots are not bookable.</p>':''}<p class="o-feedback">Monday–Friday · 09:00–17:00 · Asia/Shanghai</p>${formActions(old?'Save / reschedule':personal?'Save schedule':'Book meeting')}${old?`<div class="o-section-space o-card-actions">${button('Cancel this meeting',`data-cancel="${old.id}"`)}${old.series_id?button('Cancel remaining series',`data-cancel-series="${old.id}"`):''}</div>`:''}</form>`,{old});
    const booking=$('o-dialog-body').querySelector('form');
    if(old?.series_id)booking.elements.slot_date.max=old.repeat_until;
    bookingSummary(booking);
  }
  function bookingSummary(form){
    const start=form.elements.start_minutes,mins=Number(start.value),length=Number(form.elements.duration_minutes.value),valid=mins+length<=1020;
    start.setCustomValidity(valid?'':'Meetings must end by 17:00. Choose an earlier start or 30 minutes.');$('booking-summary').textContent=valid?`${time(mins/60)}–${time((mins+length)/60)} · ${length} minutes`:'Meetings must end by 17:00. Choose an earlier start or 30 minutes.';
    if(!form.elements.repeat_rule)return;
    const rule=form.elements.repeat_rule.value,end=form.elements.repeat_until,from=form.elements.slot_date.value,repeating=rule!=='none';
    end.disabled=!repeating;end.required=repeating;end.min=from;end.max=from?addDays(from,366):'';end.closest('label').hidden=!repeating;
    const preview=$('repeat-preview');preview.hidden=!repeating;if(!repeating)return;
    const dates=repeatDates(from,end.value,rule);
    preview.innerHTML=(dates.length?`<strong>${dates.length} meeting${dates.length===1?'':'s'} · through ${E(end.value)} (inclusive)</strong><details><summary>Review all dates</summary><ul>${dates.map(d=>`<li>${E(d)} · ${time(mins/60)}–${time((mins+length)/60)}</li>`).join('')}</ul></details>`:'Choose an end date to preview the meetings.')+`<p>All occurrences must be available; any conflict stops the whole series.${rule==='monthly'?' Same calendar date each month. Weekends and nonexistent dates are skipped, never shifted.':''}</p>`;
  }
  function projectMembers(id){const p=project(id);if(!p||!faculty())return;modal('Project members',`<p class="o-sub">${E(p.name)}. Each change is saved immediately. Faculty always retains access.</p><div class="o-members-list">${S.rows.members.filter(m=>m.active).map(m=>`<label class="o-member-check"><input type="checkbox" data-membership="${m.id}" data-project="${p.id}" ${S.rows.project_members.some(x=>x.member_id===m.id&&x.project_id===id)?'checked':''}>${E(m.display_name)} · ${E(m.role)}</label>`).join('')}</div><div class="o-error" role="alert"></div><div class="o-dialog-actions">${button('Done','data-close')}</div>`);}
  function account(){modal('My account',`<p class="o-sub">${E(S.session.user.email)}</p><form data-form="profile"><div class="o-fields">${input('Display name','display_name',S.me.display_name,'text','required maxlength="100"')}</div>${formActions('Save name')}</form><div class="o-section-space">${button('Change password','data-change-password')}</div>`);}
  function deleteDialog(type,id){const r=row(type==='meetings'?'calendar_slots':type,id);if(!r||!faculty())return;modal('Delete permanently',`<form data-form="delete"><div class="o-danger-box"><strong>${E(title(type==='meetings'?'calendar_slots':type,r))}</strong><p>This permanently deletes this record. It cannot be restored in ORBIT.${type==='projects'?' Linked papers must first be moved or explicitly deleted. They will never be deleted automatically.':''}</p></div>${input('Type DELETE to confirm','confirmation','','text','required pattern="DELETE" autocomplete="off"')}${formActions('Delete permanently')}</form>`,{type,id});}
  async function saveRecord(form,context){
    const {type,old}=context,data=new FormData(form),get=k=>String(data.get(k)??'').trim(),nullable=k=>get(k)||null;
    let payload={};const vis=faculty()?get('visibility'):(old?.visibility||'members');
    if(type==='projects')payload={name:get('name'),research_question:get('research_question'),status:get('status'),visibility:vis};
    if(type==='papers')payload={title:get('title'),owner_id:faculty()?get('owner_id'):(old?.owner_id||uid()),project_id:old&&!faculty()?old.project_id:nullable('project_id'),status:get('status'),current_holder_id:get('holder')==='journal'?null:nullable('holder'),external_holder:get('holder')==='journal'?'Journal':'',next_person_id:nullable('next_person_id'),target_date:nullable('target_date'),next_action:get('next_action'),link:get('link'),handoff:get('handoff'),visibility:vis};
    if(type==='expenses')payload={description:get('description'),owner_id:faculty()?get('owner_id'):(old?.owner_id||uid()),amount:Number(get('amount')),currency:'CNY',status:faculty()?get('status'):(old?.status||'To submit'),receipt_status:get('receipt_status'),receipt_link:get('receipt_link'),input_tokens:nullable('input_tokens')===null?null:Number(get('input_tokens')),output_tokens:nullable('output_tokens')===null?null:Number(get('output_tokens')),notes:get('notes'),visibility:get('visibility')};
    if(type==='tasks'){
      if(old&&!faculty()&&old.owner_id!==uid())payload={done:data.has('done')};
      else payload={title:get('title'),owner_id:faculty()?get('owner_id'):(old?.owner_id||uid()),due_date:nullable('due_date'),category:get('category'),done:data.has('done'),participant_ids:faculty()?[...new Set(data.getAll('participant_ids').map(String))].filter(id=>id!==get('owner_id')):(old?.participant_ids||[])};
    }
    if(type==='signals')payload={title:get('title'),kind:get('kind'),link:get('link'),notes:get('notes')};
    for(const key of ['link','receipt_link'])if(payload[key]&&!safeURL(payload[key]))throw new Error('Use an http or https link.');
    if((payload.handoff==='Link provided'&&!payload.link)||(payload.receipt_status==='Link provided'&&!payload.receipt_link))throw new Error('Add the link, or choose an offline/pending handoff.');
    if(old){unwrap(await db.from('orbit_'+type).update(payload).eq('id',old.id).eq('updated_at',old.updated_at).select('id').single());}
    else if(type==='projects'){await rpc('orbit_create_project',{p_name:payload.name,p_rq:payload.research_question,p_status:payload.status,p_visibility:payload.visibility});}
    else{if(type==='tasks')payload.created_by=uid();if(type==='signals')payload.owner_id=uid();unwrap(await db.from('orbit_'+type).insert(payload).select('id').single());}
  }
  async function mutate(action,message){
    if(S.saving||!S.ready)return;S.saving=true;
    try{await action();S.saving=false;close();await loadWorkspace({silent:true});toast(message);}
    catch(error){S.saving=false;const box=$('o-dialog-body').querySelector('.o-error');if(!$('o-overlay').hidden&&box)box.textContent=errorText(error);else toast(errorText(error));}
  }
  root.addEventListener('submit',async event=>{
    const form=event.target;if(form.id==='auth-form')return;event.preventDefault();if(!form.dataset.form||S.saving)return;
    const context=formContext,data=new FormData(form),get=k=>String(data.get(k)??'').trim();
    const controls=[...form.querySelectorAll('button')];controls.forEach(b=>b.disabled=true);
    await mutate(async()=>{
      if(form.dataset.form==='record')return saveRecord(form,context);
      if(form.dataset.form==='booking'){
        const mins=Number(get('start_minutes')),length=Number(get('duration_minutes'));
        if(!Number.isInteger(mins)||mins%30!==0||mins<540||![30,60].includes(length)||mins+length>1020)throw new Error('Choose a half-hour start between 09:00 and 16:30, ending by 17:00.');
        const payload={slot_date:get('slot_date'),start_hour:Math.floor(mins/60),start_minute:mins%60,duration_minutes:length,owner_id:faculty()?get('owner_id'):uid(),kind:'meeting',topic:get('topic'),location:get('location'),notes:get('notes')};
        const day=new Date(payload.slot_date+'T12:00:00Z').getUTCDay();if(day===0||day===6)throw new Error('Choose Monday through Friday.');
        if(!context.old&&get('repeat_rule')!=='none'){
          const rule=get('repeat_rule'),until=get('repeat_until');
          if(!repeatNames[rule]||!repeatDates(payload.slot_date,until,rule).length)throw new Error('Choose a valid repeat schedule and an end date within one year.');
          return rpc('orbit_create_meeting_series',{p_owner_id:payload.owner_id,p_topic:payload.topic,p_start_date:payload.slot_date,p_start_minutes:mins,p_duration_minutes:length,p_repeat_rule:rule,p_until:until,p_location:payload.location,p_notes:payload.notes});
        }
        return unwrap(await (context.old?db.from('orbit_calendar_slots').update(payload).eq('id',context.old.id).eq('updated_at',context.old.updated_at):db.from('orbit_calendar_slots').insert(payload)).select('id').single());
      }
      if(form.dataset.form==='delete')return rpc('orbit_delete_record',{p_entity:context.type,p_id:context.id,p_confirmation:get('confirmation')});
      if(form.dataset.form==='profile')return unwrap(await db.from('orbit_members').update({display_name:get('display_name')}).eq('id',uid()).select('id').single());
      if(form.dataset.form==='activate')return rpc('orbit_activate_student',{p_email:get('email'),p_name:get('display_name')});
    },form.dataset.form==='delete'?'Record permanently deleted. It cannot be restored in ORBIT.':'Saved.');
    controls.forEach(b=>b.disabled=false);
  });
  root.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.hasAttribute('data-theme-toggle')){setTheme(root.dataset.theme==='light'?'dark':'light');try{localStorage.setItem('orbit-color-theme',root.dataset.theme);}catch{}return;}
    if(b.hasAttribute('data-close'))return close();
    if(b.hasAttribute('data-signout'))return signOut();
    if(!S.ready)return;
    if(b.dataset.view){S.view=b.dataset.view;S.filter='active';S.busyMode=false;render();return;}
    if(b.dataset.filter){S.filter=b.dataset.filter;render();return;}
    if(b.dataset.layout&&Object.hasOwn(S.layouts,b.dataset.layout)&&['cards','list'].includes(b.dataset.mode)){const key=b.dataset.layout,mode=b.dataset.mode;S.layouts[key]=mode;render();root.querySelector(`[data-layout="${key}"][data-mode="${mode}"]`)?.focus();return;}
    if(b.hasAttribute('data-personal-schedule')&&faculty())return bookingForm(null,S.week,540,true);
    if(b.hasAttribute('data-refresh'))return loadWorkspace();
    if(b.dataset.edit)return recordForm(b.dataset.edit,b.dataset.id);
    if(b.dataset.projectMembers)return projectMembers(b.dataset.projectMembers);
    if(b.hasAttribute('data-account'))return account();
    if(b.hasAttribute('data-change-password')){close();needPassword=true;authScreen('password');return;}
    if(b.dataset.life){const archive=b.dataset.archive==='true';return mutate(()=>rpc('orbit_set_archived',{p_entity:b.dataset.life,p_id:b.dataset.id,p_archive:archive}),archive?'Archived. Find it in the Archived view.':'Restored.');}
    if(b.dataset.delete)return deleteDialog(b.dataset.delete,b.dataset.id);
    if(b.dataset.cancel){const id=b.dataset.cancel;modal('Cancel meeting',`<p class="o-sub">Cancel this meeting and release its time slot? Its record will remain in cancelled history.</p><div class="o-error" role="alert"></div><div class="o-dialog-actions">${button('Keep meeting','data-close')}${button('Cancel meeting',`data-confirm-cancel="${id}"`,true)}</div>`);return;}
    if(b.dataset.confirmCancel)return mutate(()=>rpc('orbit_cancel_slot',{p_id:b.dataset.confirmCancel}),'Meeting cancelled. The time slot is available again.');
    if(b.dataset.cancelSeries){const r=row('calendar_slots',b.dataset.cancelSeries);if(!r?.series_id)return;const from=r.slot_date>dateNow()?r.slot_date:dateNow();modal('Cancel remaining series',`<p class="o-sub">${E(r.topic)} — cancel ${faculty()?'all active':'all of your active'} occurrences in this series from ${E(from)} through ${E(r.repeat_until)}? Earlier occurrences stay unchanged. Cancelled records remain in history.</p><div class="o-error" role="alert"></div><div class="o-dialog-actions">${button('Keep series','data-close')}${button('Cancel remaining series',`data-confirm-series="${r.id}" data-from="${from}"`,true)}</div>`);return;}
    if(b.dataset.confirmSeries)return mutate(()=>rpc('orbit_cancel_meeting_series',{p_id:b.dataset.confirmSeries,p_from:b.dataset.from}),'Remaining series cancelled. Earlier occurrences were kept.');
    if(b.hasAttribute('data-busy-mode')){if(faculty()){S.busyMode=!S.busyMode;render();}return;}
    if(b.dataset.week||b.hasAttribute('data-this-week')){S.week=b.hasAttribute('data-this-week')?monday(dateNow()):addDays(S.week,Number(b.dataset.week));return loadWorkspace({silent:true});}
    if(b.dataset.booking)return bookingForm(b.dataset.booking);
    if(b.dataset.slot){
      const [d,h]=b.dataset.slot.split('/'),mins=Number(h),own=S.rows.calendar_slots.find(x=>!x.cancelled_at&&covers(x,d,mins)),occ=S.occupancy.find(x=>covers(x,d,mins));
      if(own?.kind==='meeting')return bookingForm(own.id);
      if(faculty()&&S.busyMode)return mutate(()=>own?.kind==='busy'?rpc('orbit_cancel_slot',{p_id:own.id}):db.from('orbit_calendar_slots').insert({slot_date:d,start_hour:Math.floor(mins/60),start_minute:mins%60,duration_minutes:30,kind:'busy'}).select('id').single().then(unwrap),own?'Busy block reopened.':'Marked 30 minutes busy.');
      if(!occ)return bookingForm(null,d,mins);return;
    }
    if(b.hasAttribute('data-activate')&&faculty()){modal('Activate student',`<form data-form="activate"><p class="o-sub">The account must already exist in Supabase Auth with a confirmed email. No password is collected here.</p><div class="o-fields">${input('Student name','display_name','','text','required maxlength="100"')}${input('Confirmed email','email','','email','required')}</div>${formActions('Activate membership')}</form>`);return;}
    if(b.dataset.memberState&&faculty()){
      const id=b.dataset.memberState,active=b.dataset.active==='true',m=S.directory.find(x=>x.id===id);
      modal(active?'Reactivate membership':'Revoke access',`<p class="o-sub">${E(m?.display_name)} ${active?'will regain their authorized workspace access.':'will lose workspace data access, including with an existing login session. Records will be kept.'}</p><div class="o-error" role="alert"></div><div class="o-dialog-actions">${button('Cancel','data-close')}${button(active?'Reactivate':'Revoke access',`data-confirm-member="${id}" data-active="${active}"`,true)}</div>`);return;
    }
    if(b.dataset.confirmMember)return mutate(()=>rpc('orbit_set_student_active',{p_id:b.dataset.confirmMember,p_active:b.dataset.active==='true'}),'Membership updated.');
  });
  root.addEventListener('change',async event=>{
    const el=event.target;if(el.closest('form[data-form="booking"]'))bookingSummary(el.closest('form'));
    if(!el.dataset.membership||!faculty()||S.saving)return;
    const id=el.dataset.membership,projectId=el.dataset.project,checked=el.checked;el.disabled=true;S.saving=true;
    try{
      if(checked)unwrap(await db.from('orbit_project_members').insert({project_id:projectId,member_id:id}));
      else unwrap(await db.from('orbit_project_members').delete().eq('project_id',projectId).eq('member_id',id));
      await loadWorkspace({silent:true});toast('Project membership saved.');
    }catch(error){el.checked=!checked;$('o-dialog-body').querySelector('.o-error').textContent=errorText(error);}
    finally{S.saving=false;el.disabled=false;}
  });
  $('o-overlay').addEventListener('click',event=>{if(event.target===$('o-overlay'))close();});
  root.addEventListener('keydown',event=>{
    if($('o-overlay').hidden)return;if(event.key==='Escape')return close();
    if(event.key==='Tab'){const nodes=[...$('o-overlay').querySelectorAll('button,input,select,textarea,a[href]')].filter(n=>!n.disabled&&!n.closest('fieldset[disabled]'));const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });
  $('auth-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!db)return;$('auth-error').textContent='';$('auth-submit').disabled=true;
    try{
      if(authMode==='login'){unwrap(await db.auth.signInWithPassword({email:$('auth-email').value.trim(),password:$('auth-password').value}));$('auth-password').value='';}
      else if(authMode==='reset'){unwrap(await db.auth.resetPasswordForEmail($('auth-email').value.trim(),{redirectTo:window.ORBIT_CONFIG.siteUrl}));$('auth-error').textContent='If this address is eligible, a reset email has been requested. If nothing arrives, ask your administrator to check email delivery.';}
      else if(authMode==='password'){
        const password=$('auth-password').value;if(password!==$('auth-confirm').value)throw new Error('Passwords do not match.');
        if(password.length<12)throw new Error('Use at least 12 characters.');
        unwrap(await db.auth.updateUser({password}));$('auth-password').value='';$('auth-confirm').value='';needPassword=false;
        history.replaceState(null,'',location.pathname);await loadWorkspace({silent:true});toast('Password updated.');
      }
    }catch(error){$('auth-error').textContent=errorText(error);}finally{$('auth-submit').disabled=false;}
  });
  $('forgot-password').addEventListener('click',()=>authScreen('reset'));
  $('back-login').addEventListener('click',()=>authScreen());
  $('auth-signout').addEventListener('click',()=>signOut());
  $('auth-retry').addEventListener('click',()=>loadWorkspace());
  // Static code-native stars; no image requests or tracking pixels.
  document.querySelectorAll('.o-main').forEach(main=>{const sky=document.createElement('div');sky.className='o-sky';sky.setAttribute('aria-hidden','true');const cover=main.classList.contains('o-auth');let seed=1289;const rand=()=>((seed=seed*16807%2147483647)-1)/2147483646;for(let i=0;i<(cover?620:210);i++){const star=document.createElement('span');star.className='o-star'+(i%47===0?' bright':'');const size=i%47===0?2.2:.6+rand()*1.4;const x=rand()*100,y=cover&&i>210?(x*.72+(rand()-.5)*44+100)%100:rand()*100;star.style.cssText=`left:${x}%;top:${y}%;width:${size}px;height:${size}px;--star-opacity:${.25+rand()*.65}`;sky.appendChild(star);}main.prepend(sky);});
  try{
    if(!window.supabase?.createClient)throw new Error('The sign-in library could not load. Check access to cdn.jsdelivr.net and reload this page.');
    // Sessions persist within this tab only. No passwords or research records
    // are stored in localStorage, and the preview widget bridge is not used.
    db=window.supabase.createClient(window.ORBIT_CONFIG.supabaseUrl,window.ORBIT_CONFIG.publishableKey,{auth:{storage:sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'orbit-auth-v1'}});
    const linkError=new URLSearchParams(location.hash.slice(1)).get('error_description');
    authScreen('login',linkError||'');
    db.auth.onAuthStateChange((event,session)=>{setTimeout(()=>applyAuth(event,session),0);});
    db.auth.getSession().then(result=>{if(result.error)authScreen('login',errorText(result.error));else applyAuth('INITIAL_SESSION',result.data.session);});
  }catch(error){authScreen('login',errorText(error));$('auth-submit').disabled=true;$('forgot-password').hidden=true;}
  setInterval(()=>{if(S.ready&&document.visibilityState==='visible'&&$('o-overlay').hidden&&!S.saving&&!needPassword)void loadWorkspace({silent:true});},60000);
})();
