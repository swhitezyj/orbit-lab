/* ORBIT workbench. All writes go through permission-checked Supabase RPCs. */
window.ORBIT_WORKBENCH = function(A){
  'use strict';
  const {S,E,button,modal,rpc,row,person,date,faculty,input,select,textarea}=A;
  const kinds={move:'Next move',question:'Question',finding:'Finding',decision:'Decision',learned:'Tried / learned'};
  const el=()=>document.getElementById('o-dialog-body');
  const ctx=()=>A.context();
  const action=(label,act,attrs='')=>button(label,`data-wb-action="${act}" ${attrs}`);
  const errorBox='<div class="o-error wb-error" role="alert"></div>';
  const error=e=>e?.code==='PGRST202'?'Research workbench and time ranges need database update 017. Existing records are still available.':A.errorText(e);
  const studyName=id=>S.research?.studies.find(s=>s.id===id)?.name||'Related study';
  const connectionRows=id=>(S.workbenchMap?.connections||[]).filter(c=>c.study_id===id||c.related_id===id);
  const relatedId=(c,id)=>c.study_id===id?c.related_id:c.study_id;
  function summary(id){
    const brief=S.workbenchMap?.briefs.find(b=>b.study_id===id)?.body;
    const links=connectionRows(id);
    return (brief?`<p><span class="o-rq-label">Current contribution</span>${E(brief)}</p>`:'')+
      (links.length?`<details class="wb-connections-summary"><summary>Related research · ${links.length}</summary>${links.map(c=>`<p>${E(studyName(relatedId(c,id)))} <span class="o-muted">· ${E(c.relation)}</span></p>`).join('')}</details>`:'');
  }
  async function open(type,id){
    if(!['projects','papers'].includes(type)||!row(type,id))return;
    const c={kind:'workbench',type,id,data:null,editing:null,undo:null,user:S.me.id};
    modal(type==='projects'?'Study workbench':'Paper workbench',`<p class="o-note">Loading research workspace…</p>${errorBox}`,c);
    try{c.data=await rpc('orbit_workbench',{p_entity:type,p_id:id});if(ctx()===c&&S.me?.id===c.user)draw();}
    catch(e){if(ctx()===c){el().innerHTML=`<p class="o-note">${E(error(e))}</p>${action('Open existing record editor','metadata')}`;}}
  }
  function linkedMoves(){
    const c=ctx(),moves=c.data.linked_moves||[];
    return moves.length?`<details data-wb-fold="paper-moves"><summary>Paper next moves · read-only references</summary><p class="o-feedback">These belong to their papers, not this study’s next-move count. Open the paper to edit.</p>${moves.map(m=>`<p class="${m.completed?'is-complete':''}"><span class="o-rq-label">${E(S.research?.papers.find(p=>p.id===m.paper_id)?.title||'Linked paper')}</span><span class="wb-entry-text">${m.completed?'✓ ':''}${E(m.body)}</span> <span class="o-muted">· ${E(date(m.due_date))}</span></p>`).join('')}</details>`:'';
  }
  function entryForm(kind,old=null,question=null,command='save'){
    const c=ctx(),editing=!!old;
    return `<form class="wb-entry-form ${kind==='move'?'wb-move-form':''}" data-form="wb-entry" data-entry-id="${E(old?.id||question?.id||'')}" data-command="${command}" data-kind="${kind}">
      ${question?`<p class="o-note">From question: ${E(question.body)}${command==='decision'?'<br>Saving records a decision and resolves this question.':'<br>The question stays open.'}</p>`:''}
      ${kind==='move'?input('Next move','body',old?.body||'','text','required maxlength="2000" placeholder="A concrete next step, not a progress percentage"')+input('Due date · optional','due_date',old?.due_date||'','date'):textarea(kind==='question'?'Question to discuss':kinds[kind],'body',old?.body||'')}
      ${kind==='move'?'':textarea(kind==='question'?'Context · optional':'Short context · optional','context',old?.context||'')+input('External link · optional','link',old?.link||'','url','maxlength="2000" placeholder="https://…"')}
      <div class="wb-form-actions"><button class="o-btn primary" type="submit">${editing?'Save changes':command==='decision'?'Record decision':kind==='move'?'Add next move':kind==='question'?'Add question':'Add note'}</button>${editing||question?action('Cancel','cancel-edit'):''}</div>
    </form>`;
  }
  function entry(r){
    const c=ctx(),can=c.data.editable,question=c.data.entries.find(q=>q.id===r.question_id);
    if(c.editing?.id===r.id){
      if(c.editing.action==='edit')return entryForm(r.kind,r);
      return entryForm(c.editing.action==='decision'?'decision':'move',null,r,c.editing.action);
    }
    const controls=can?`<div class="wb-entry-actions">${r.kind==='question'?r.resolved?action('Reopen','reopen',`data-entry="${r.id}"`):action('Record decision','decision',`data-entry="${r.id}"`)+action('Add next move','next_move',`data-entry="${r.id}"`):''}${action('Edit','edit',`data-entry="${r.id}"`)}${action('Remove','delete',`data-entry="${r.id}"`)}</div>`:'';
    return `<article class="wb-entry ${r.completed?'is-complete':''}">${r.kind==='move'?`<div class="wb-move-line"><button type="button" class="wb-check" data-wb-action="complete" data-entry="${r.id}" aria-label="${r.completed?'Reopen':'Complete'} ${E(r.body)}" aria-pressed="${r.completed}" ${can?'':'disabled'}>${r.completed?'✓':'○'}</button><span class="wb-entry-text">${E(r.body)}</span><span class="wb-due ${r.due_date&&!r.completed&&r.due_date<A.dateNow()?'is-late':''}">${E(date(r.due_date))}</span></div>`:`<div class="wb-entry-heading"><span class="o-rq-label">${E(kinds[r.kind])}</span>${r.resolved?'<span class="o-badge green">Resolved</span>':''}</div><p class="wb-entry-text">${E(r.body)}</p>${r.context?`<p class="wb-context">${E(r.context)}</p>`:''}${A.external(r.link)}`}
      ${question?`<p class="o-feedback">From question: ${question.deleted_at?'[removed question]':E(question.body)}</p>`:''}
      <div class="wb-entry-foot"><span class="o-muted">${E(r.creator||'Lab member')} · ${E(date(r.created_at.slice(0,10)))}</span>${controls}</div></article>`;
  }
  function draw(){
    const c=ctx();if(c?.kind!=='workbench'||!c.data)return;
    const openSections=[...el().querySelectorAll('details[open][data-wb-fold]')].map(x=>x.dataset.wbFold);
    const r=row(c.type,c.id),isStudy=c.type==='projects',d=c.data,can=d.editable;
    const entries=d.entries.filter(x=>!x.deleted_at),moves=entries.filter(x=>x.kind==='move').sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.created_at.localeCompare(b.created_at));
    const done=moves.filter(x=>x.completed),todo=moves.filter(x=>!x.completed),questions=entries.filter(x=>x.kind==='question'),resolved=questions.filter(x=>x.resolved);
    const trail=entries.filter(x=>!['question','move'].includes(x.kind)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
    const inherited=d.inherited_study_id,study=isStudy?r:S.research?.studies.find(s=>s.id===inherited);
    const papers=isStudy?(S.research?.papers||[]).filter(p=>p.project_id===c.id):[];
    const removed=d.entries.filter(x=>x.deleted_at).sort((a,b)=>b.deleted_at.localeCompare(a.deleted_at));
    const briefEditable=can&&!inherited;
    el().innerHTML=`<div class="wb-shell"><header class="wb-header"><div><div class="o-kicker">${isStudy?'A QUESTION TAKING SHAPE':'A PAPER IN MOTION'}</div><h2>${E(isStudy?r.name:r.title)}</h2><div class="o-card-top"><span class="o-badge">${E(r.status)}</span><span class="o-muted">${can?'Shared editing · record members':'Read-only · existing record access'}</span></div></div><div class="o-card-actions">${action('Record details','metadata')}${isStudy?action('Members & leads','team'):''}${action('Reload','reload')}</div></header>
      ${!isStudy?`<div class="o-handoff">With <strong>${E(r.external_holder||person(r.current_holder_id))}</strong> → Next <strong>${E(person(r.next_person_id))}</strong><span> · ${E(date(r.target_date))}</span></div>`:''}
      <section class="wb-brief"><div class="o-panel-head"><h3>Research brief</h3>${briefEditable?action(c.editBrief?'Cancel':'Edit brief','brief'):''}</div>${study?`<p><span class="o-rq-label">Research question</span>${E(study.research_question||'Still taking shape.')}</p>`:''}
      ${isStudy?`<p class="o-muted">Members · ${S.rows.project_members.filter(m=>m.project_id===c.id).map(m=>E(person(m.member_id))).join(' · ')||'Faculty only'}</p>`:''}
      ${c.editBrief?`<form data-form="wb-brief">${textarea(isStudy?'Current contribution · visible to the lab':'Short research description','body',d.brief.body)}<button type="submit" class="o-btn primary">Save brief</button></form>`:`<p><span class="o-rq-label">${isStudy||inherited?'Current contribution':'Research description'}</span>${E(d.brief.body||'Still taking shape.')}</p>`}
      <p class="o-feedback">${inherited?'Inherited from '+E(studyName(inherited))+'. Edit the study to change this brief.':isStudy?'RQ and contribution are shared with the lab. Keep internal notes below.':'For this independent or direct-program paper; existing detail access applies.'}</p></section>
      ${errorBox}<div class="wb-status" role="status">${c.undo?`Removed. ${action('Undo','restore',`data-entry="${c.undo}"`)}`:''}</div>
      <div class="wb-columns"><div><section class="wb-section"><div class="o-panel-head"><h3>Next moves <span class="wb-count">${todo.length}</span></h3></div><p class="o-sub">The next useful steps. Shared by the team.</p>
      ${todo.map(entry).join('')||'<p class="wb-empty">What would move this work forward?</p>'}${can?entryForm('move'):''}
      ${done.length?`<details data-wb-fold="completed"><summary>Completed · ${done.length}</summary>${done.map(entry).join('')}</details>`:''}</section>
      <section class="wb-section"><h3>For discussion <span class="wb-count">${questions.filter(x=>!x.resolved).length}</span></h3><p class="o-sub">Questions worth bringing to the next conversation.</p>
      ${questions.filter(x=>!x.resolved).map(entry).join('')||'<p class="wb-empty">No open questions yet.</p>'}
      ${can?`<details data-wb-fold="add-question"><summary>+ Add a question</summary>${entryForm('question')}</details>`:''}
      ${resolved.length?`<details data-wb-fold="resolved"><summary>Resolved · ${resolved.length}</summary>${resolved.map(entry).join('')}</details>`:''}</section></div>
      <div><section class="wb-section"><h3>${isStudy?'Research':'Paper'} trail</h3><p class="o-sub">What changed our thinking, and why.</p>
      ${can?`<details data-wb-fold="add-trail"><summary>+ Add a short note</summary><div class="wb-trail-types">${['finding','decision','learned'].map(k=>action(kinds[k],'trail-kind',`data-kind="${k}" aria-pressed="${(c.trailKind||'finding')===k}"`)).join('')}</div>${entryForm(c.trailKind||'finding')}</details>`:''}
      ${trail.map(entry).join('')||'<p class="wb-empty">Findings, decisions, and approaches you tried belong here.</p>'}</section>
      ${isStudy?`<section class="wb-section"><h3>Papers & connections</h3>${papers.length?papers.map(p=>`<div class="wb-paper"><span>${E(p.title)}</span><span class="o-muted">${E(p.status)}</span>${row('papers',p.id)?action('Open paper','open',`data-entity="papers" data-id="${p.id}"`):'<span class="o-muted">Summary only</span>'}</div>`).join(''):'<p class="wb-empty">No linked papers yet.</p>'}<p class="o-feedback">Each paper keeps its own next moves. Nothing is copied into this study.</p>
      ${connectionRows(c.id).map(link=>`<div class="wb-connection"><span>${E(studyName(relatedId(link,c.id)))}</span><span class="o-muted">${E(link.relation)}</span>${row('projects',relatedId(link,c.id))?action('Open study','open',`data-entity="projects" data-id="${relatedId(link,c.id)}"`):''}${can&&link.study_id===c.id?action('Remove link','unlink',`data-related="${link.related_id}"`):''}</div>`).join('')}
      ${can?`<details data-wb-fold="add-link"><summary>+ Connect another study</summary><p class="o-feedback">Study names and connection labels are visible to the lab. A connection never grants detail access.</p><form data-form="wb-link">${select('Study','related_id',[['','Choose a study…'],...(S.research?.studies||[]).filter(s=>s.id!==c.id).map(s=>[s.id,s.name])],'','required')}${select('Connection','relation',['Related question','Shared data or method','Could converge'],'Related question')}<button type="submit" class="o-btn">Save connection</button></form></details>`:''}</section>`:inherited&&row('projects',inherited)?`<section class="wb-section">${action('Open parent study','open',`data-entity="projects" data-id="${inherited}"`)}</section>`:''}</div></div>
      ${can&&removed.length?`<details class="wb-removed" data-wb-fold="removed"><summary>Removed items · ${removed.length}</summary><p class="o-feedback">Restore an accidental removal. Permanent removal happens only when the parent record is permanently deleted.</p>${removed.map(x=>`<div class="wb-paper"><span>${E(kinds[x.kind])} · ${E(x.body)}</span>${action('Restore','restore',`data-entry="${x.id}"`)}</div>`).join('')}</details>`:''}
      ${isStudy?linkedMoves():''}<p class="o-feedback">Next moves, discussions, and trail entries follow this record’s existing detail access. They are never included in the lab-wide research map.</p></div>`;
    for(const key of openSections)el().querySelector(`[data-wb-fold="${key}"]`)?.setAttribute('open','');
    el().querySelectorAll('textarea[name=body]').forEach(x=>{x.required=true;x.maxLength=2000;});
    el().querySelectorAll('textarea[name=context]').forEach(x=>x.maxLength=3000);
    if(c.editing)el().querySelector(`.wb-entry-form[data-entry-id="${c.editing.id}"] [name=body]`)?.focus();
  }
  async function run(task,{undo=null}={}){
    const c=ctx();if(c?.kind!=='workbench'||S.saving)return;
    S.saving=true;const controls=[...el().querySelectorAll('button')].map(b=>[b,b.disabled]);controls.forEach(([b])=>b.disabled=true);
    const box=el().querySelector('.wb-error');if(box)box.textContent='';
    let saved=false;
    try{
      await task(c);saved=true;
      const [data,map]=await Promise.all([rpc('orbit_workbench',{p_entity:c.type,p_id:c.id}),rpc('orbit_workbench_map',{})]);
      if(ctx()!==c||S.me?.id!==c.user)return;
      c.data=data;S.workbenchMap=map;c.editing=null;c.editBrief=false;c.undo=undo;S.saving=false;
      A.render();draw();
    }catch(e){if(ctx()===c){if(e?.code==='42501'){c.data=null;el().innerHTML=`<p class="o-note">${E(error(e))}</p>`;}else if(box)box.textContent=(saved?'Saved, but reloading failed. Use Reload before making more changes. ':'')+error(e);}}
    finally{if(ctx()===c){S.saving=false;controls.forEach(([b,disabled])=>{if(b.isConnected)b.disabled=disabled;});}}
  }
  async function command(actionName,id,value={}){
    const c=ctx(),r=c?.data.entries.find(e=>e.id===id);
    if(!r)return;
    return run(()=>rpc('orbit_workbench_entry',{p_entity:c.type,p_parent_id:c.id,p_id:r.id,p_expected_version:r.version,p_action:actionName,p_value:value}),{undo:actionName==='delete'?id:null});
  }
  function click(b){
    const c=ctx(),act=b.dataset.wbAction;if(S.saving)return;
    if(act==='block')return blockForm();
    if(act==='all-day'){el().querySelector('[name=start]').value='09:00';el().querySelector('[name=end]').value='17:00';return;}
    if(act==='unblock')return A.mutate(()=>rpc('orbit_cancel_slot',{p_id:b.dataset.id}),'Entire busy block reopened.');
    if(c?.kind!=='workbench')return;
    if(act==='metadata')return A.recordForm(c.type,c.id);
    if(act==='team'&&c.type==='projects')return A.projectMembers(c.id);
    if(act==='reload')return open(c.type,c.id);
    if(act==='open')return open(b.dataset.entity,b.dataset.id);
    if(!c.data?.editable)return;
    if(act==='brief'){c.editBrief=!c.editBrief;draw();return;}
    if(act==='trail-kind'){c.trailKind=b.dataset.kind;draw();return;}
    if(act==='cancel-edit'){c.editing=null;draw();return;}
    if(['edit','decision','next_move'].includes(act)){c.editing={id:b.dataset.entry,action:act};draw();return;}
    if(act==='complete'){const r=c.data.entries.find(e=>e.id===b.dataset.entry);return command('complete',r.id,{completed:!r.completed});}
    if(['delete','restore','reopen'].includes(act))return command(act,b.dataset.entry);
    if(act==='unlink')return run(()=>rpc('orbit_workbench_connection',{p_study_id:c.id,p_related_id:b.dataset.related,p_relation:'Related question',p_delete:true}));
  }
  async function submit(form){
    const data=new FormData(form),get=k=>String(data.get(k)||'').trim(),c=ctx();
    if(form.dataset.form==='wb-block'){
      if(!faculty())return;
      const mins=s=>Number(s.split(':')[0])*60+Number(s.split(':')[1]);
      return A.mutate(()=>rpc('orbit_block_time',{p_date:get('date'),p_start:mins(get('start')),p_end:mins(get('end'))}),'Time blocked. Existing meetings unchanged.');
    }
    if(!c?.data?.editable)return;
    if(form.dataset.form==='wb-brief')return run(()=>rpc('orbit_save_workbench_brief',{p_entity:c.type,p_id:c.id,p_expected_version:c.data.brief.version,p_body:get('body')}));
    if(form.dataset.form==='wb-link')return run(()=>rpc('orbit_workbench_connection',{p_study_id:c.id,p_related_id:get('related_id'),p_relation:get('relation'),p_delete:false}));
    if(form.dataset.form==='wb-entry'){
      const old=c.data.entries.find(x=>x.id===form.dataset.entryId);
      return run(()=>rpc('orbit_workbench_entry',{p_entity:c.type,p_parent_id:c.id,p_id:old?.id||null,p_expected_version:old?.version||null,p_action:form.dataset.command,
        p_value:{kind:form.dataset.kind,body:get('body'),due_date:get('due_date'),context:form.dataset.kind==='move'?old?.context||'':get('context'),link:form.dataset.kind==='move'?old?.link||'':get('link')}}));
    }
  }
  function blockForm(){
    if(!faculty())return;
    modal('Block unavailable time',`<form data-form="wb-block"><p class="o-note">One weekday · Asia/Shanghai. A range is saved as one block. Any overlap with a meeting or busy block rejects the whole request; no meetings are cancelled.</p><div class="o-fields">${input('Date','date',S.week,'date','required')}${input('Start','start','09:00','time','required min="09:00" max="16:30" step="1800"')}${input('End','end','17:00','time','required min="09:30" max="17:00" step="1800"')}</div>${action('All working day · 09:00–17:00','all-day')}${A.formActions('Block time')}</form>`,{kind:'block-time'});
  }
  function unblock(s){
    modal('Reopen this busy block?',`<p class="o-note">${E(s.slot_date)} · ${A.time(A.startMinutes(s)/60)}–${A.time((A.startMinutes(s)+A.duration(s))/60)}. This reopens the entire block, not just the half-hour cell. Meetings are unchanged.</p>${errorBox}<div class="o-dialog-actions">${button('Keep block','data-close')}${action('Reopen entire block','unblock',`data-id="${s.id}"`)}</div>`,{kind:'block-time'});
  }
  return {open,click,submit,summary,unblock};
};
