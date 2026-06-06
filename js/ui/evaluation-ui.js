'use strict';
const EvaluationUI = (() => {
  let _detections=[], _proposals=[], _userValues=[], _currentIdx=0;
  let _sourceCanvas=null, _sessionMode='video', _sessionStart=0;
  let _validated=0, _rejected=0;

  function startSession(detections, sourceCanvas, mode='video') {
    _detections=detections; _sourceCanvas=sourceCanvas; _sessionMode=mode;
    _proposals=detections.map(d=>EvaluationEngine.propose(d,sourceCanvas));
    _userValues=_proposals.map(p=>({...p.values}));
    _currentIdx=0; _sessionStart=Date.now(); _validated=0; _rejected=0;
    document.getElementById('eval-mode-badge').textContent=mode.toUpperCase();
    _renderCurrent();
    Screens.show('evaluation');
  }

  function _renderCurrent() {
    const det=_detections[_currentIdx], prop=_proposals[_currentIdx], values=_userValues[_currentIdx];
    const info=SIGN_CATALOG[det.signType]||SIGN_CATALOG['UNKNOWN'];
    const total=_detections.length;
    document.getElementById('eval-counter').textContent=`Señal ${_currentIdx+1}/${total}`;
    document.getElementById('btn-eval-prev').disabled=_currentIdx===0;
    document.getElementById('btn-eval-next').disabled=_currentIdx===total-1;
    const thumb=document.getElementById('eval-thumbnail');
    if(det.crop){thumb.width=det.crop.width;thumb.height=det.crop.height;thumb.getContext('2d').drawImage(det.crop,0,0);}
    document.getElementById('eval-signal-type').textContent=det.signType;
    document.getElementById('eval-confidence').textContent=`${prop.confidence}%`;
    document.getElementById('eval-type-tag').textContent=det.isHorizontal?'HORIZONTAL':'VERTICAL';
    document.getElementById('eval-location').textContent=Geo.formatForDisplay(det.gps);
    document.getElementById('eval-timestamp').textContent=new Date(det.ts).toLocaleString('es-ES',{timeStyle:'short',dateStyle:'short'});
    _updateGauge(calcRating(values));
    _renderParams(values,prop.values);
  }

  function _updateGauge(rating) {
    const fill=document.getElementById('gauge-fill'), valueEl=document.getElementById('gauge-value');
    fill.style.strokeDashoffset=157-(rating/100)*157;
    fill.style.stroke=ratingColor(rating);
    valueEl.textContent=rating;
    valueEl.className=`gauge-value ${ratingClass(rating)}`;
  }

  function _renderParams(values, aiValues) {
    const c=document.getElementById('eval-params'); c.innerHTML='';
    for(const param of PARAMS){
      const val=values[param.id]??3, aiVal=aiValues[param.id]??3;
      const isEdited=val!==aiVal, pct=((val-1)/4)*100;
      const color=val>=5?'#22c55e':val>=4?'#84cc16':val>=3?'#f5c518':val>=2?'#f97316':'#ef4444';
      const row=document.createElement('div');
      row.className=`param-row ${isEdited?'user-edited':'ai-proposed'}`;
      row.innerHTML=`<div class="param-icon">${param.icon}</div>
        <div class="param-body"><div class="param-name">${param.label}</div>
        <div class="param-value">${param.levels[val-1].label}</div></div>
        <div class="param-bar-wrap"><div class="param-bar">
        <div class="param-bar-fill" style="width:${pct}%;background:${color}"></div></div></div>
        <div class="param-source-badge ${isEdited?'badge-user':'badge-ai'}">${isEdited?'TÚ':'IA'}</div>`;
      c.appendChild(row);
    }
  }

  async function validate() {
    const det=_detections[_currentIdx], prop=_proposals[_currentIdx], userVals=_userValues[_currentIdx];
    const changed=Object.keys(userVals).some(k=>userVals[k]!==prop.values[k]);
    const evalRecord=_buildRecord(det,prop,userVals,changed?'edited':'accepted');
    const id=await DB.saveEvaluation(evalRecord);
    if(det.crop) det.crop.toBlob(b=>DB.saveCropImage(id,b),'image/jpeg',0.8);
    await EvaluationEngine.recordValidation(det,prop.values,userVals,!changed);
    _validated++;
    Toast.show('Señal validada ✓','success');
    _advance();
  }

  async function reject() {
    const det=_detections[_currentIdx];
    await DB.saveEvaluation(_buildRecord(det,_proposals[_currentIdx],null,'rejected'));
    _rejected++;
    Toast.show('Señal rechazada','warning');
    _advance();
  }

  function _advance() {
    if(_currentIdx<_detections.length-1){_currentIdx++;_renderCurrent();}
    else _showSummary();
  }

  function _buildRecord(det,prop,userVals,status){
    return{ts:det.ts||Date.now(),signType:det.signType,category:det.category,
      isHorizontal:!!det.isHorizontal,bbox:det.bbox,
      lat:det.gps?.lat||null,lng:det.gps?.lng||null,accuracy:det.gps?.acc||null,
      aiValues:prop.values,aiRating:prop.rating,userValues:userVals||null,
      finalRating:userVals?calcRating(userVals):null,status,sessionMode:_sessionMode,confidence:prop.confidence};
  }

  function navigateTo(idx){if(idx>=0&&idx<_detections.length){_currentIdx=idx;_renderCurrent();}}
  function getCurrentIndex(){return _currentIdx;}

  function openEditor() {
    const values=_userValues[_currentIdx], body=document.getElementById('editor-body');
    body.innerHTML='';
    body.removeEventListener('click',_editorClick);
    for(const param of PARAMS){
      const current=values[param.id]??3;
      const block=document.createElement('div');
      block.className='editor-param-block';
      block.innerHTML=`<div class="editor-param-header">
        <span class="editor-param-icon">${param.icon}</span>
        <span class="editor-param-label">${param.label}</span>
        <span class="editor-param-current">${param.description}</span></div>
        <div class="editor-param-options" data-param="${param.id}">
        ${param.levels.map(l=>`<button class="editor-option ${l.value===current?'selected':''}"
          data-value="${l.value}" data-param="${param.id}">
          <span>${l.value}</span><span>${l.label}</span></button>`).join('')}</div>`;
      body.appendChild(block);
    }
    body.addEventListener('click',_editorClick);
    _updateEditorRating();
    Screens.show('editor');
  }

  function _editorClick(e){
    const btn=e.target.closest('.editor-option'); if(!btn)return;
    const param=btn.dataset.param, value=parseInt(btn.dataset.value);
    btn.closest('.editor-param-options').querySelectorAll('.editor-option').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    _userValues[_currentIdx][param]=value;
    _updateEditorRating();
  }

  function _updateEditorRating(){
    const rating=calcRating(_userValues[_currentIdx]);
    const el=document.getElementById('editor-rating-live');
    el.textContent=rating; el.className=`editor-rating-value ${ratingClass(rating)}`;
  }

  function saveEditor(){_renderCurrent();Screens.back();Toast.show('Cambios guardados','success');}

  function _showSummary(){
    const elapsed=Math.round((Date.now()-_sessionStart)/60000);
    const total=_validated+_rejected;
    const ratings=_detections.map((_,i)=>_userValues[i]?calcRating(_userValues[i]):null).filter(r=>r!==null);
    const avg=ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length):0;
    document.getElementById('summary-count').textContent=`${total} señales evaluadas`;
    document.getElementById('summary-time').textContent=`en ${elapsed||'<1'} minuto${elapsed!==1?'s':''}`;
    document.getElementById('summary-stats').innerHTML=`
      <div class="summary-stat-row"><span class="summary-stat-label">Validadas</span><span class="summary-stat-value">${_validated}</span></div>
      <div class="summary-stat-row"><span class="summary-stat-label">Rechazadas</span><span class="summary-stat-value">${_rejected}</span></div>
      <div class="summary-stat-row"><span class="summary-stat-label">Rating medio</span><span class="summary-stat-value ${ratingClass(avg)}">${avg}</span></div>`;
    Screens.show('summary');
  }

  function getCurrentDetections(){return _detections;}
  function getCurrentProposals(){return _proposals;}
  function getUserValues(){return _userValues;}

  return{startSession,validate,reject,openEditor,saveEditor,navigateTo,getCurrentIndex,getCurrentDetections,getCurrentProposals,getUserValues};
})();
