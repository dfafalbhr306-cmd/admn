const INITIAL_CLIENTS = [];
const INITIAL_OPERATIONS = [];
const STORAGE_KEYS={clients:'port2026_clients',operations:'port2026_operations',theme:'port2026_theme'};const state={clients:[],operations:[],activeView:'view-dashboard',reportRows:[],ledgerRows:[]};const qs=(s,sc=document)=>sc.querySelector(s), qsa=(s,sc=document)=>Array.from(sc.querySelectorAll(s));const clone=(d)=>JSON.parse(JSON.stringify(d));const safeNumber=(v)=>{if(v===null||v===undefined||v==='')return 0;const n=Number(String(v).replace(/,/g,'').trim());return Number.isFinite(n)?n:0;};const PROFIT_PER_CONTAINER=750000;const TAX_RATE=0.15;const formatMoney=(v)=>new Intl.NumberFormat('ar-IQ').format(safeNumber(v))+' د.ع';const formatDate=(v)=>{if(!v)return'—';const raw=String(v).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){const[y,m,d]=raw.split('-');return `${d}/${m}/${y}`;}return raw;};const uid=(p='id')=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;function showToast(m){const t=qs('#toast');t.textContent=m;t.classList.add('show');clearTimeout(showToast._t);showToast._t=setTimeout(()=>t.classList.remove('show'),2500);}function normalizeDateInput(v){if(!v)return'';const r=String(v).trim();return /^\d{4}-\d{2}-\d{2}$/.test(r)?r:'';}function dayNameFromDate(v){if(!v||!/^\d{4}-\d{2}-\d{2}$/.test(String(v)))return'';const n=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];return n[new Date(v+'T00:00:00').getDay()]||'';}function normalizeOperation(op,fallbackSeq){const client=state.clients.find(c=>c.name===op.clientName)||state.clients.find(c=>c.code===op.clientCode);const containerCount=safeNumber(op.containerCount);const clearancePerContainer=safeNumber(op.clearancePerContainer);const clearanceValue=safeNumber(op.clearanceValue)||(containerCount*clearancePerContainer);const profitManual=!!op.profitManual;const profit=profitManual?safeNumber(op.profit):(containerCount*PROFIT_PER_CONTAINER);const tax=profit*TAX_RATE;const extraReturns=safeNumber(op.extraReturns);const extraYardFees=safeNumber(op.extraYardFees);const extraTruckFees=safeNumber(op.extraTruckFees);const totalAmount=safeNumber(op.totalAmount)||(clearanceValue+extraReturns+extraYardFees+extraTruckFees);return {id:op.id||uid('op'),seq:op.seq||fallbackSeq,clientName:op.clientName||'',clientCode:op.clientCode||client?.code||'',operationType:op.operationType||'تخليص',billNo:op.billNo||'',containerSize:op.containerSize||'',containerCount,clearancePerContainer,clearanceValue,arrivalDate:normalizeDateInput(op.arrivalDate),arrivalDay:op.arrivalDay||dayNameFromDate(op.arrivalDate),receiptDate:normalizeDateInput(op.receiptDate),receiptDay:op.receiptDay||dayNameFromDate(op.receiptDate),exitDate:normalizeDateInput(op.exitDate),exitDay:op.exitDay||dayNameFromDate(op.exitDate),receiver:op.receiver||'',receivedAmount:safeNumber(op.receivedAmount),paymentDate:normalizeDateInput(op.paymentDate),remaining:safeNumber(op.remaining),profit,profitManual,tax,extraReturns,extraYardFees,extraTruckFees,totalAmount,details:op.details||''};}function loadState() {
  if(!window.db) {
    setTimeout(loadState, 200);
    return;
  }
  const dbDataRef = window.dbRef(window.db, 'system_data');
  window.dbOnValue(dbDataRef, (snapshot) => {
    const data = snapshot.val() || { clients: [], operations: [] };
    state.clients = data.clients || [];
    state.operations = data.operations || [];
    if(state.clients[0]){
       const ls = qs('#ledgerCompanySelect');
       const qs1 = qs('#quickPrintCompanySelect')
       if(ls && !ls.value) ls.value=state.clients[0].name;
       if(qs1 && !qs1.value) qs1.value=state.clients[0].name;
    }
    refreshAll();
  });
}
function saveState() {
  if(!window.db) return;
  const dbDataRef = window.dbRef(window.db, 'system_data');
  window.dbSet(dbDataRef, {
    clients: state.clients,
    operations: state.operations
  });
}
function resetToSeed(){if(!confirm('سيتم تصفير النظام مسح كل البيانات الحالية؟'))return;state.clients=[];state.operations=[];saveState();refreshAll();showToast('تم تصفير النظام');}function findLinkedClearance(clientName,billNo,excludeId=''){if(!clientName||!billNo)return null;const rows=state.operations.filter(r=>r.operationType!=='دفعة نقدية'&&r.clientName===clientName&&String(r.billNo||'').trim()===String(billNo).trim()&&r.id!==excludeId);return rows.sort((a,b)=>safeNumber(b.seq)-safeNumber(a.seq))[0]||null;}function getPaymentsForBill(clientName,billNo,excludeId=''){return state.operations.filter(r=>r.operationType==='دفعة نقدية'&&r.clientName===clientName&&String(r.billNo||'').trim()===String(billNo).trim()&&r.id!==excludeId);}function syncPaymentLinkedData(){const isPayment=qs('#operationType').value==='دفعة نقدية';if(!isPayment)return;const linked=findLinkedClearance(qs('#clientName').value,qs('#billNo').value,qs('#operationEditId').value);if(!linked)return;qs('#containerSize').value=linked.containerSize||'';qs('#containerCount').value=linked.containerCount||'';qs('#totalAmount').value=linked.totalAmount||linked.clearanceValue||'';}function calculatePaymentRemaining(payload,excludeId=''){const linked=findLinkedClearance(payload.clientName,payload.billNo,excludeId);const linkedTotal=safeNumber(linked?.totalAmount||payload.totalAmount);const paidBefore=getPaymentsForBill(payload.clientName,payload.billNo,excludeId).reduce((s,r)=>s+safeNumber(r.receivedAmount),0);return linkedTotal-(paidBefore+safeNumber(payload.receivedAmount));}function recalcOperationFields(source='form'){const count=safeNumber(qs('#containerCount').value), per=safeNumber(qs('#clearancePerContainer').value), clearance=count*per;qs('#clearanceValue').value=clearance||'';const total=clearance+safeNumber(qs('#extraReturns').value)+safeNumber(qs('#extraYardFees').value)+safeNumber(qs('#extraTruckFees').value);qs('#totalAmount').value=total||'';const profitInput=qs('#profit');if(source==='resetAuto'){delete profitInput.dataset.manual;}if(source!=='profitManual'&&!profitInput.dataset.manual){profitInput.value=(count*PROFIT_PER_CONTAINER)||'';}qs('#tax').value=(safeNumber(profitInput.value)*TAX_RATE)||'';syncPaymentLinkedData();}function getClientSummary(clientName,rows=state.operations){const items=rows.filter(r=>r.clientName===clientName), clearanceRows=items.filter(r=>r.operationType!=='دفعة نقدية');const debt=clearanceRows.reduce((s,r)=>s+safeNumber(r.totalAmount),0), payments=items.reduce((s,r)=>s+safeNumber(r.receivedAmount),0), remaining=debt-payments, profit=clearanceRows.reduce((s,r)=>s+safeNumber(r.profit),0), tax=clearanceRows.reduce((s,r)=>s+safeNumber(r.tax),0), containers=clearanceRows.reduce((s,r)=>s+safeNumber(r.containerCount),0);return {items,clearanceRows,debt,payments,remaining,profit,tax,containers};}function renderRecentOperationsTable(rows){if(!rows.length)return '<div class="notice-box">لا توجد بيانات مطابقة.</div>';return `<table><thead><tr><th>العدد</th><th>رقم البوليصة</th><th>عدد الحاويات</th><th>حجم الحاويات</th><th>تاريخ الوصول</th><th>تاريخ الاستلام</th><th>تاريخ الخروج</th><th>مبلغ تخليص المفرد</th><th>مبلغ التخليص الكلي</th><th>مبلغ العوائد الإضافية</th><th>مبلغ أجور ساحات إضافية</th><th>مبلغ أجور خط إضافي</th><th>مجموع المبالغ الكلية</th><th>الأرباح</th><th>الضرائب</th><th>صافي الأرباح</th><th>التفاصيل</th></tr></thead><tbody>${rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+(r.billNo||'—')+'</td><td>'+(r.containerCount||'—')+'</td><td>'+(r.containerSize||'—')+'</td><td>'+formatDate(r.arrivalDate)+'</td><td>'+formatDate(r.receiptDate)+'</td><td>'+formatDate(r.exitDate)+'</td><td>'+formatMoney(r.clearancePerContainer)+'</td><td>'+formatMoney(r.clearanceValue)+'</td><td>'+formatMoney(r.extraReturns)+'</td><td>'+formatMoney(r.extraYardFees)+'</td><td>'+formatMoney(r.extraTruckFees)+'</td><td>'+formatMoney(r.totalAmount)+'</td><td>'+formatMoney(r.profit)+'</td><td>'+formatMoney(r.tax)+'</td><td>'+formatMoney(safeNumber(r.profit)-safeNumber(r.tax))+'</td><td>'+(r.details||'—')+'</td></tr>').join('')}</tbody></table>`;}

function refreshDashboard(){const clearanceRows=state.operations.filter(r=>r.operationType!=='دفعة نقدية');const debt=clearanceRows.reduce((s,r)=>s+safeNumber(r.totalAmount),0), payments=state.operations.reduce((s,r)=>s+safeNumber(r.receivedAmount),0), remaining=debt-payments, profit=clearanceRows.reduce((s,r)=>s+safeNumber(r.profit),0), tax=clearanceRows.reduce((s,r)=>s+safeNumber(r.tax),0), profitRemaining=profit-tax, containers=clearanceRows.reduce((s,r)=>s+safeNumber(r.containerCount),0);qs('#statDebt').textContent=formatMoney(debt);qs('#statPayments').textContent=formatMoney(payments);qs('#statRemaining').textContent=formatMoney(remaining);qs('#statRemaining').className=remaining<0?'negative':'positive';qs('#statProfit').textContent=formatMoney(profit);qs('#statTax').textContent=formatMoney(tax);qs('#statProfitRemaining').textContent=formatMoney(profitRemaining);qs('#statProfitRemaining').className=profitRemaining<0?'negative':'positive';const recent=[...state.operations].sort((a,b)=>(b.seq||0)-(a.seq||0)).slice(0,8);qs('#recentOperations').innerHTML=renderRecentOperationsTable(recent);const active=state.clients.map(c=>({...c,summary:getClientSummary(c.name)})).filter(i=>i.summary.items.length).sort((a,b)=>b.summary.debt-a.summary.debt);qs('#dashboardCompanies').innerHTML=active.length?active.map(i=>`<article class="company-mini"><h4>${i.name}</h4><p>الكود: ${i.code}</p><p>المجموع المبالغ الكليه: <strong>${formatMoney(i.summary.debt)}</strong></p><p>ديون: <strong>${formatMoney(i.summary.debt)}</strong></p><p>مقبوضات: <strong>${formatMoney(i.summary.payments)}</strong></p><p>متبقي: <strong>${formatMoney(i.summary.remaining)}</strong></p><p>ارباح: <strong>${formatMoney(i.summary.profit)}</strong></p><p>ضرائب: <strong>${formatMoney(i.summary.tax)}</strong></p><p>عدد الحاويات: <strong>${new Intl.NumberFormat('ar-IQ').format(i.summary.containers)}</strong></p></article>`).join(''):`<div class="notice-box">لا توجد بيانات شركات فعالة حالياً.</div>`;}function renderCompanies(){const term=qs('#companySearch').value.trim();const filtered=state.clients.filter(c=>!term||c.name.includes(term)||c.code.includes(term));qs('#companiesTable').innerHTML=`<table><thead><tr><th>ت</th><th>اسم الشركة</th><th>الكود</th><th>عدد الحركات</th><th>عدد الحاويات</th><th>إجمالي الديون</th><th>المقبوضات</th><th>المتبقي</th><th>إجراء</th></tr></thead><tbody>${filtered.map((c,i)=>{const s=getClientSummary(c.name);return `<tr><td>${i+1}</td><td>${c.name}</td><td>${c.code}</td><td>${s.items.length}</td><td>${new Intl.NumberFormat('ar-IQ').format(s.containers)}</td><td>${formatMoney(s.debt)}</td><td>${formatMoney(s.payments)}</td><td>${formatMoney(s.remaining)}</td><td><div class="row-actions"><button class="row-btn" style="background:rgba(255,193,7,.22); color:#ffc107;" data-company-view="${c.id}">عرض</button><button class="row-btn edit" data-company-edit="${c.id}">تعديل</button><button class="row-btn delete" data-company-delete="${c.id}">حذف</button></div></td></tr>`;}).join('')}</tbody></table>`;}function renderOperationsTable(rows,withActions=true){if(!rows.length)return `<div class="notice-box">لا توجد بيانات مطابقة.</div>`;return `<table><thead><tr><th>ت</th><th>اسم العميل</th><th>الكود</th><th>نوع العملية</th><th>رقم البوليصة</th><th>حجم الحاوية</th><th>عدد الحاويات</th><th>قيمة التخليص</th><th>الواصل</th><th>تاريخ الوصول</th><th>تاريخ الدفعة</th><th>المجموع الكلي</th><th>التفاصيل</th>${withActions?'<th>إجراء</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr><td>${r.seq}</td><td>${r.clientName||'—'}</td><td>${r.clientCode||'—'}</td><td><span class="badge ${r.operationType==='دفعة نقدية'?'payment':'clearance'}">${r.operationType}</span></td><td>${r.billNo||'—'}</td><td>${r.containerSize||'—'}</td><td>${r.containerCount||'—'}</td><td>${formatMoney(r.clearanceValue)}</td><td>${formatMoney(r.receivedAmount)}</td><td>${formatDate(r.arrivalDate)}</td><td>${formatDate(r.paymentDate)}</td><td>${formatMoney(r.totalAmount)}</td><td>${r.details||'—'}</td>${withActions?`<td><div class="row-actions"><button class="row-btn edit" data-op-edit="${r.id}">تعديل</button><button class="row-btn delete" data-op-delete="${r.id}">حذف</button></div></td>`:''}</tr>`).join('')}</tbody></table>`;}function renderOperations(){const term=qs('#operationSearch').value.trim(), type=qs('#operationFilterType').value;const rows=state.operations.filter(r=>{const mt=!term||[r.clientName,r.billNo,r.details,r.clientCode].join(' ').includes(term);const my=type==='all'||r.operationType===type;return mt&&my;});qs('#operationsTable').innerHTML=renderOperationsTable(rows,true);}function populateClientSelects(){const options=state.clients.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');['#clientName','#ledgerCompanySelect','#reportCompanySelect','#quickPrintCompanySelect'].forEach(sel=>{const select=qs(sel);if(!select)return;const cur=select.value, includeAll=sel==='#reportCompanySelect';select.innerHTML=`${includeAll?'<option value="all">كل الشركات</option>':''}${options}`;if(cur&&[...select.options].some(o=>o.value===cur))select.value=cur;});syncClientCode();}function syncClientCode(){const selected=state.clients.find(c=>c.name===qs('#clientName').value);qs('#clientCode').value=selected?.code||'';}function updateOperationTypeUI(){const isPayment=qs('#operationType').value==='دفعة نقدية';qs('#clearanceFields').style.display=isPayment?'none':'grid';qs('#paymentFields').style.display='grid';if(isPayment){['arrivalDate','receiptDate','exitDate','receiver','profit','tax','extraReturns','extraYardFees','extraTruckFees'].forEach(id=>{const el=qs('#'+id);if(el)el.value='';});delete qs('#profit').dataset.manual;syncPaymentLinkedData();}else{recalcOperationFields('resetAuto');}}function companyFormSubmit(e){e.preventDefault();const editId=qs('#companyEditId').value;const payload={id:editId||uid('client'),name:qs('#companyName').value.trim(),code:qs('#companyCode').value.trim()};if(!payload.name||!payload.code)return showToast('أكمل بيانات الشركة');const dup=state.clients.find(i=>(i.name===payload.name||i.code===payload.code)&&i.id!==payload.id);if(dup)return showToast('الاسم أو الكود موجود مسبقاً');if(editId){const index=state.clients.findIndex(i=>i.id===editId), old=state.clients[index];state.clients[index]=payload;state.operations=state.operations.map(op=>op.clientName===old.name||op.clientCode===old.code?{...op,clientName:payload.name,clientCode:payload.code}:op);showToast('تم تعديل الشركة');}else{state.clients.push(payload);showToast('تمت إضافة الشركة');}qs('#companyForm').reset();qs('#companyEditId').value='';saveState();refreshAll();}function clearOperationForm(){qs('#operationForm').reset();qs('#operationEditId').value='';delete qs('#profit').dataset.manual;if(state.clients.length)qs('#clientName').value=state.clients[0].name;syncClientCode();qs('#operationType').value='تخليص';updateOperationTypeUI();recalcOperationFields('resetAuto');}function operationFormSubmit(e){e.preventDefault();const editId=qs('#operationEditId').value, type=qs('#operationType').value;const linkedPaymentData=type==='دفعة نقدية'?findLinkedClearance(qs('#clientName').value,qs('#billNo').value,editId):null;const payload=normalizeOperation({id:editId||uid('op'),seq:editId?state.operations.find(op=>op.id===editId)?.seq:(Math.max(0,...state.operations.map(op=>safeNumber(op.seq)))+1),clientName:qs('#clientName').value,clientCode:qs('#clientCode').value,operationType:type,billNo:qs('#billNo').value.trim(),containerSize:type==='دفعة نقدية'?(linkedPaymentData?.containerSize||qs('#containerSize').value):qs('#containerSize').value,containerCount:type==='دفعة نقدية'?(linkedPaymentData?.containerCount||qs('#containerCount').value):qs('#containerCount').value,clearancePerContainer:qs('#clearancePerContainer').value,clearanceValue:qs('#clearanceValue').value,arrivalDate:qs('#arrivalDate').value,arrivalDay:dayNameFromDate(qs('#arrivalDate').value),receiptDate:qs('#receiptDate').value,receiptDay:dayNameFromDate(qs('#receiptDate').value),exitDate:qs('#exitDate').value,exitDay:dayNameFromDate(qs('#exitDate').value),receiver:qs('#receiver').value.trim(),receivedAmount:qs('#receivedAmount').value,paymentDate:qs('#paymentDate').value,remaining:0,profit:qs('#profit').value,profitManual:qs('#profit').dataset.manual==='1',tax:qs('#tax').value,extraReturns:qs('#extraReturns').value,extraYardFees:qs('#extraYardFees').value,extraTruckFees:qs('#extraTruckFees').value,totalAmount:type==='دفعة نقدية'?(linkedPaymentData?.totalAmount||qs('#totalAmount').value):qs('#totalAmount').value,details:qs('#details').value.trim()});if(!payload.clientName)return showToast('اختر اسم العميل');if(!payload.billNo)return showToast('أدخل رقم البوليصة');if(type==='تخليص'&&!payload.containerCount)return showToast('أدخل عدد الحاويات');if(type==='دفعة نقدية'&&!linkedPaymentData)return showToast('لا توجد عملية تخليص مرتبطة بهذه الشركة ورقم البوليصة');if(type==='دفعة نقدية'){payload.remaining=calculatePaymentRemaining(payload,editId);}if(editId){const index=state.operations.findIndex(op=>op.id===editId);state.operations[index]=payload;showToast('تم تعديل العملية');}else{state.operations.push(payload);showToast('تمت إضافة العملية');}state.operations.sort((a,b)=>safeNumber(a.seq)-safeNumber(b.seq));saveState();clearOperationForm();refreshAll();}function fillOperationForm(id){const op=state.operations.find(i=>i.id===id);if(!op)return;qs('#operationEditId').value=op.id;qs('#clientName').value=op.clientName;syncClientCode();qs('#operationType').value=op.operationType;qs('#billNo').value=op.billNo||'';qs('#containerSize').value=op.containerSize||'';qs('#containerCount').value=op.containerCount||'';qs('#clearancePerContainer').value=op.clearancePerContainer||'';qs('#clearanceValue').value=op.clearanceValue||'';qs('#arrivalDate').value=op.arrivalDate||'';qs('#receiptDate').value=op.receiptDate||'';qs('#exitDate').value=op.exitDate||'';qs('#receiver').value=op.receiver||'';qs('#receivedAmount').value=op.receivedAmount||'';qs('#paymentDate').value=op.paymentDate||'';qs('#profit').value=op.profit||'';qs('#tax').value=op.tax||'';if(op.profitManual){qs('#profit').dataset.manual='1';}else{delete qs('#profit').dataset.manual;}qs('#extraReturns').value=op.extraReturns||'';qs('#extraYardFees').value=op.extraYardFees||'';qs('#extraTruckFees').value=op.extraTruckFees||'';qs('#totalAmount').value=op.totalAmount||'';qs('#details').value=op.details||'';updateOperationTypeUI();recalcOperationFields(qs('#profit').dataset.manual?'profitManual':'form');switchView('view-operations');showToast('تم تحميل العملية للتعديل');}function fillCompanyForm(id){const company=state.clients.find(i=>i.id===id);if(!company)return;qs('#companyEditId').value=company.id;qs('#companyName').value=company.name;qs('#companyCode').value=company.code;switchView('view-companies');}function deleteOperation(id){if(!confirm('حذف هذه العملية؟'))return;state.operations=state.operations.filter(i=>i.id!==id);state.operations.forEach((i,idx)=>i.seq=idx+1);saveState();refreshAll();showToast('تم حذف العملية');}function deleteCompany(id){const company=state.clients.find(i=>i.id===id);if(!company)return;const used=state.operations.some(op=>op.clientName===company.name||op.clientCode===company.code);if(used)return showToast('لا يمكن حذف شركة لديها حركات');if(!confirm('حذف هذه الشركة؟'))return;state.clients=state.clients.filter(i=>i.id!==id);saveState();refreshAll();showToast('تم حذف الشركة');}function renderLedgerLikeTable(rows){if(!rows.length)return `<div class="notice-box">لا توجد حركات لهذه الشركة.</div>`;return `<table><thead><tr><th>ت</th><th>نوع العملية</th><th>رقم البوليصة</th><th>حجم الحاوية</th><th>عدد الحاويات</th><th>قيمة تخليص الحاوية</th><th>القيمة الاجمالية</th><th>تاريخ الوصول</th><th>تاريخ الاستلام</th><th>تاريخ الخروج</th><th>الواصل</th><th>تاريخ الدفعة</th><th>التفاصيل</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.seq}</td><td>${r.operationType}</td><td>${r.billNo||'—'}</td><td>${r.containerSize||'—'}</td><td>${r.containerCount||'—'}</td><td>${formatMoney(r.clearancePerContainer)}</td><td>${formatMoney(r.totalAmount||r.clearanceValue)}</td><td>${formatDate(r.arrivalDate)}</td><td>${formatDate(r.receiptDate)}</td><td>${formatDate(r.exitDate)}</td><td>${formatMoney(r.receivedAmount)}</td><td>${formatDate(r.paymentDate)}</td><td>${r.details||'—'}</td></tr>`).join('')}</tbody></table>`;}function renderLedger(){const company=qs('#ledgerCompanySelect').value||state.clients[0]?.name||'';if(!company){qs('#ledgerSummary').innerHTML='<div class="notice-box">لا توجد شركات.</div>';qs('#ledgerTable').innerHTML='';return;}const summary=getClientSummary(company);state.ledgerRows=summary.items;const obj=state.clients.find(c=>c.name===company);qs('#ledgerSummary').innerHTML=`<article class="stat-card glass"><span>اسم العميل</span><strong>${company}</strong><small>الكود: ${obj?.code||'—'}</small></article><article class="stat-card glass"><span>عدد الحاويات</span><strong>${new Intl.NumberFormat('ar-IQ').format(summary.containers)}</strong><small>عمليات التخليص فقط</small></article><article class="stat-card glass"><span>إجمالي الديون</span><strong>${formatMoney(summary.debt)}</strong><small>من التخليص والخدمات</small></article><article class="stat-card glass"><span>إجمالي المدفوعات</span><strong>${formatMoney(summary.payments)}</strong><small>الدفعات النقدية المسجلة</small></article><article class="stat-card glass"><span>صافي الديون</span><strong class="${summary.remaining<0?'negative':'positive'}">${formatMoney(summary.remaining)}</strong><small>المتبقي بعد الطرح</small></article><article class="stat-card glass"><span>الأرباح / الضريبة</span><strong>${formatMoney(summary.profit)} / ${formatMoney(summary.tax)}</strong><small>ملخص مالي</small></article>`;qs('#ledgerTable').innerHTML=renderLedgerLikeTable(summary.items);}function applyReportFilter(){const company=qs('#reportCompanySelect').value, type=qs('#reportTypeSelect').value, from=qs('#reportFromDate').value, to=qs('#reportToDate').value;const rows=state.operations.filter(r=>{const mc=company==='all'||r.clientName===company, mt=type==='all'||r.operationType===type;const d=r.paymentDate||r.arrivalDate||r.receiptDate||r.exitDate;const mf=!from||(d&&d>=from), mto=!to||(d&&d<=to);return mc&&mt&&mf&&mto;});state.reportRows=rows;const debt=rows.filter(r=>r.operationType!=='دفعة نقدية').reduce((s,r)=>s+safeNumber(r.totalAmount),0), payments=rows.reduce((s,r)=>s+safeNumber(r.receivedAmount),0), profit=rows.filter(r=>r.operationType!=='دفعة نقدية').reduce((s,r)=>s+safeNumber(r.profit),0), tax=rows.filter(r=>r.operationType!=='دفعة نقدية').reduce((s,r)=>s+safeNumber(r.tax),0), containers=rows.filter(r=>r.operationType!=='دفعة نقدية').reduce((s,r)=>s+safeNumber(r.containerCount),0);qs('#reportSummary').innerHTML=`<article class="stat-card glass"><span>عدد الحركات</span><strong>${new Intl.NumberFormat('ar-IQ').format(rows.length)}</strong><small>بعد الفلترة</small></article><article class="stat-card glass"><span>إجمالي الديون</span><strong>${formatMoney(debt)}</strong><small>الحركات غير النقدية</small></article><article class="stat-card glass"><span>إجمالي المقبوضات</span><strong>${formatMoney(payments)}</strong><small>كل الدفعات في النتائج</small></article><article class="stat-card glass"><span>الأرباح</span><strong>${formatMoney(profit)}</strong><small>من نتائج التقرير</small></article><article class="stat-card glass"><span>الضرائب</span><strong>${formatMoney(tax)}</strong><small>من نتائج التقرير</small></article><article class="stat-card glass"><span>عدد الحاويات</span><strong>${new Intl.NumberFormat('ar-IQ').format(containers)}</strong><small>ضمن النتائج</small></article>`;qs('#reportTable').innerHTML=renderOperationsTable(rows,false);
const invoiceBtn = qs('#invoiceReportBtn');
const manualInvoiceBtn = qs('#manualInvoiceBtn');
if (invoiceBtn) { invoiceBtn.style.display = company === 'all' ? 'none' : 'inline-flex'; }
if (manualInvoiceBtn) { manualInvoiceBtn.style.display = company === 'all' ? 'none' : 'inline-flex'; }
}

function renderInvoice() {
  const company = qs('#reportCompanySelect').value;
  if (company === 'all') return;
  const displayEl = qs('#invoiceCompanyNameDisplay');
  if (displayEl) displayEl.textContent = company;

  const rows = state.reportRows;
  const clearanceRows = rows.filter(r => r.operationType !== 'دفعة نقدية');
  
  let tableHtml = `
    <table style="width:100%; border-collapse:collapse; color:#000; text-align:center; border: 2px solid #000; margin-bottom: 20px; font-weight: bold;" dir="rtl">
      <thead style="background:#eaeaea;">
        <tr>
          <th style="border: 1px solid #000; padding:10px;">رقم البوليصه</th>
          <th style="border: 1px solid #000; padding:10px;">عدد الحاويات</th>
          <th style="border: 1px solid #000; padding:10px;">حجم الحاويات</th>
          <th style="border: 1px solid #000; padding:10px;">سعر المفرد</th>
          <th style="border: 1px solid #000; padding:10px;">مجموع التخليص</th>
          <th style="border: 1px solid #000; padding:10px;">التاريخ</th>
        </tr>
      </thead>
      <tbody>
  `;
  clearanceRows.forEach(r => {
    tableHtml += `
        <tr>
          <td style="border: 1px solid #000; padding:8px;">${r.billNo || '—'}</td>
          <td style="border: 1px solid #000; padding:8px;">${r.containerCount || '—'}</td>
          <td style="border: 1px solid #000; padding:8px;">${r.containerSize || '—'}</td>
          <td style="border: 1px solid #000; padding:8px;">${new Intl.NumberFormat('en-US').format(safeNumber(r.clearancePerContainer))}</td>
          <td style="border: 1px solid #000; padding:8px;">${new Intl.NumberFormat('en-US').format(safeNumber(r.clearanceValue))}</td>
          <td style="border: 1px solid #000; padding:8px;">${formatDate(r.arrivalDate)}</td>
        </tr>
    `;
  });
  tableHtml += `</tbody></table>`;
  qs('#invoiceTableContainer').innerHTML = tableHtml;

  const totalExtraTruck = clearanceRows.reduce((sum, r) => sum + safeNumber(r.extraTruckFees), 0);
  const totalExtraReturns = clearanceRows.reduce((sum, r) => sum + safeNumber(r.extraReturns), 0);
  const totalExtraYard = clearanceRows.reduce((sum, r) => sum + safeNumber(r.extraYardFees), 0);

  let totalsHtml = `
    <tr><td style="border: 1px solid #000; padding:8px; font-weight:bold; background:#eaeaea; width: 60%; text-align:right;">الاجور شحن اضافية</td><td style="border: 1px solid #000; padding:8px; text-align:center; width: 40%; font-weight:bold;">${new Intl.NumberFormat('en-US').format(totalExtraTruck)}</td></tr>
    <tr><td style="border: 1px solid #000; padding:8px; font-weight:bold; background:#eaeaea; text-align:right;">أجور عوائد إضافية بسبب التأخير</td><td style="border: 1px solid #000; padding:8px; text-align:center; font-weight:bold;">${new Intl.NumberFormat('en-US').format(totalExtraReturns)}</td></tr>
    <tr><td style="border: 1px solid #000; padding:8px; font-weight:bold; background:#eaeaea; text-align:right;">أجور ساحة خزن بسبب التأخيرية</td><td style="border: 1px solid #000; padding:8px; text-align:center; font-weight:bold;">${new Intl.NumberFormat('en-US').format(totalExtraYard)}</td></tr>
    <tr><td style="border: 1px solid #000; padding:8px; font-weight:bold; background:#eaeaea; text-align:right;">أجور مطابقات</td><td style="border: 1px solid #000; padding:8px; text-align:center; font-weight:bold;">0</td></tr>
  `;
  qs('#invoiceTotalsHtml').innerHTML = totalsHtml;

  const totalAmount = rows.filter(r => r.operationType !== 'دفعة نقدية').reduce((sum, r) => sum + safeNumber(r.totalAmount), 0);
  const payments = rows.reduce((sum, r) => sum + safeNumber(r.receivedAmount), 0);
  const remaining = totalAmount - payments;

  let finalSumsHtml = `
    <tr><td style="border: 1px solid #000; border-width: 2px 1px 1px 1px; padding:8px; font-weight:bold; background:#eaeaea; width:60%; text-align:right;">مجموع المبلغ</td><td style="border: 1px solid #000; border-width: 2px 1px 1px 1px; padding:8px; text-align:center; font-weight:bold; width:40%;">${new Intl.NumberFormat('en-US').format(totalAmount)}</td></tr>
    <tr><td style="border: 1px solid #000; padding:8px; font-weight:bold; background:#eaeaea; text-align:right;">المبلغ الواصل</td><td style="border: 1px solid #000; padding:8px; text-align:center; font-weight:bold;">${new Intl.NumberFormat('en-US').format(payments)}</td></tr>
    <tr><td style="border: 1px solid #000; border-width: 1px 1px 2px 1px; padding:8px; font-weight:bold; background:#c59e51; text-align:right;">المبلغ الباقي</td><td style="border: 1px solid #000; border-width: 1px 1px 2px 1px; padding:8px; text-align:center; font-weight:bold; background:#c59e51;">${new Intl.NumberFormat('en-US').format(remaining)}</td></tr>
  `;
  qs('#invoiceFinalSums').innerHTML = finalSumsHtml;

  switchView('view-invoice');
}
function renderManualInvoice() {
  const company = qs('#reportCompanySelect').value;
  if (company === 'all') return;
  qs('#manualInvoiceCompanyName').textContent = `الشركة: ${company}`;
  switchView('view-manual-invoice');
}
function switchView(id){state.activeView=id;qsa('.view').forEach(v=>v.classList.toggle('active',v.id===id));qsa('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.target===id));}function refreshAll(){populateClientSelects();renderCompanies();renderOperations();refreshDashboard();renderLedger();applyReportFilter();}function printSection(title,html){const win=window.open('','_blank','width=1200,height=900');if(!win)return showToast('اسمح للنوافذ المنبثقة للطباعة');win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:24px;direction:rtl}h1{margin-top:0;color:#7b0f16}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:8px;text-align:right;font-size:13px}th{background:#7b0f16;color:#fff}.stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.stat-card{border:1px solid #ddd;border-radius:12px;padding:12px}</style></head><body><h1>${title}</h1>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);win.document.close();}function exportPdf(title, rows, tableHtml) { if ((!rows || !rows.length) && !tableHtml) return showToast('لا توجد بيانات للتصدير'); if (!window.html2pdf) return showToast('مكتبة html2pdf لم تُحمّل'); const htmlContent = `<div style="padding:20px; direction:rtl; font-family:'Arial', sans-serif; background:#fff; color:#000; width: 100%;"><style>table { border-collapse: collapse; width: 100%; direction: rtl; font-size: 14px; color: #000; margin-bottom: 20px;} th, td { border: 1px solid #ccc; padding: 8px; text-align: center; display: table-cell !important; } th { background-color: #7b0f16 !important; color: #fff !important; } tr { page-break-inside: avoid; display: table-row !important; } .row-actions { display: none !important; } .stats-grid { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px; } .stat-card { border:1px solid #ccc; padding:8px; border-radius:4px; flex:1; min-width:150px; box-sizing: border-box; } span { color: #000; }</style><h2 style="color:#7b0f16; margin-bottom:16px; text-align:center;">${title}</h2>${tableHtml || renderOperationsTable(rows, false)}</div>`; const opt = { margin: [10, 10, 10, 10], filename: `${title}.pdf`, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }; html2pdf().set(opt).from(htmlContent).save(); }function quickPrintCompanyStatement(){const company=qs('#quickPrintCompanySelect').value;if(!company)return showToast('اختر شركة أولاً');qs('#ledgerCompanySelect').value=company;renderLedger();printSection(`كشف حساب - ${company}`,qs('#ledgerSummary').outerHTML+qs('#ledgerTable').outerHTML);}function quickPdfCompanyStatement(){const company=qs('#quickPrintCompanySelect').value;if(!company)return showToast('اختر شركة أولاً');qs('#ledgerCompanySelect').value=company;renderLedger();exportPdf(`كشف_حساب_${company}`,state.ledgerRows, '<div class="stats-grid">'+qs('#ledgerSummary').innerHTML+'</div>' + renderLedgerLikeTable(state.ledgerRows));}function exportJsonBackup(){const payload={exportedAt:new Date().toISOString(),clients:state.clients,operations:state.operations};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='backup_port_2026.json';link.click();URL.revokeObjectURL(link.href);}function importJsonBackup(e){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data.clients)||!Array.isArray(data.operations))throw new Error('invalid');state.clients=data.clients;state.operations=data.operations.map((op,i)=>normalizeOperation(op,i+1));saveState();refreshAll();showToast('تم استيراد النسخة الاحتياطية');}catch{showToast('ملف النسخة الاحتياطية غير صالح');}finally{e.target.value='';}};reader.readAsText(file,'utf-8');}function applyTheme(){const theme=localStorage.getItem(STORAGE_KEYS.theme)||'dark';document.body.classList.toggle('light',theme==='light');qs('#themeToggle').innerHTML=theme==='light'?'<i class="fa-solid fa-sun"></i>':'<i class="fa-solid fa-moon"></i>';}function toggleTheme(){const current=localStorage.getItem(STORAGE_KEYS.theme)||'dark';localStorage.setItem(STORAGE_KEYS.theme,current==='dark'?'light':'dark');applyTheme();}

function renderCompanyClearanceTable(clearanceOps){if(!clearanceOps.length)return '<div class="notice-box">لا توجد عمليات تخليص لهذه الشركة.</div>';return `<table><thead><tr><th>العدد</th><th>رقم البوليصة</th><th>عدد الحاويات</th><th>حجم الحاويات</th><th>تاريخ الوصول</th><th>تاريخ الاستلام</th><th>تاريخ الخروج</th><th>المبلغ المفرد</th><th>مجموع مبلغ التخليص</th><th>عوائد وأجور إضافية</th><th>أجور ساحة إضافية</th><th>غرامات شحن</th><th>مجموع المبلغ</th><th>الأرباح</th><th>الضرائب</th><th>التفاصيل</th></tr></thead><tbody>${clearanceOps.map((r,i)=>`<tr><td>${i+1}</td><td>${r.billNo||'—'}</td><td>${r.containerCount||'—'}</td><td>${r.containerSize||'—'}</td><td>${formatDate(r.arrivalDate)}</td><td>${formatDate(r.receiptDate)}</td><td>${formatDate(r.exitDate)}</td><td>${formatMoney(r.clearancePerContainer)}</td><td>${formatMoney(r.clearanceValue)}</td><td>${formatMoney(r.extraReturns)}</td><td>${formatMoney(r.extraYardFees)}</td><td>${formatMoney(r.extraTruckFees)}</td><td>${formatMoney(r.totalAmount)}</td><td>${formatMoney(r.profit)}</td><td>${formatMoney(r.tax)}</td><td>${r.details||'—'}</td></tr>`).join('')}</tbody></table>`;}function renderCompanyPaymentsTable(paymentOps){if(!paymentOps.length)return '<div class="notice-box">لا توجد دفعات لهذه الشركة.</div>';const sorted=[...paymentOps].sort((a,b)=>safeNumber(a.seq)-safeNumber(b.seq));return `<table><thead><tr><th>العدد</th><th>رقم البوليصة</th><th>عدد الحاويات</th><th>مجموع المبلغ الكلي</th><th>المبلغ الدفعة</th><th>تاريخ الدفعة</th><th>المتبقي</th><th>التفاصيل</th></tr></thead><tbody>${sorted.map((r,i)=>{const rem=calculatePaymentRemaining(r,r.id)+safeNumber(r.receivedAmount);const actualRemaining=(r.remaining!==null&&r.remaining!==undefined&&r.remaining!=='')?safeNumber(r.remaining):calculatePaymentRemaining(r,r.id);return `<tr><td>${i+1}</td><td>${r.billNo||'—'}</td><td>${r.containerCount||'—'}</td><td>${formatMoney(r.totalAmount)}</td><td>${formatMoney(r.receivedAmount)}</td><td>${formatDate(r.paymentDate)}</td><td>${formatMoney(actualRemaining)}</td><td>${r.details||'—'}</td></tr>`;}).join('')}</tbody></table>`;}function viewCompanyDetails(companyId) {const company = state.clients.find(c => c.id === companyId);if(!company) return;qs('#detailCompanyName').textContent = `بيانات شركة: ${company.name}`;qs('#companyDetailsContainer').style.display = 'block';const ops = state.operations.filter(op => op.clientName === company.name || op.clientCode === company.code);const clearanceOps = ops.filter(op => op.operationType === 'تخليص');const paymentOps = ops.filter(op => op.operationType === 'دفعة نقدية');qs('#clearanceDetailsView').innerHTML = renderCompanyClearanceTable(clearanceOps);qs('#paymentsDetailsView').innerHTML = renderCompanyPaymentsTable(paymentOps);showClearanceTab();}

function showClearanceTab() {
    qs('#clearanceDetailsView').style.display = 'block';
    qs('#paymentsDetailsView').style.display = 'none';
    qs('#tabClearanceBtn').className = 'primary-btn';
    qs('#tabPaymentsBtn').className = 'soft-btn';
}

function showPaymentsTab() {
    qs('#clearanceDetailsView').style.display = 'none';
    qs('#paymentsDetailsView').style.display = 'block';
    qs('#tabClearanceBtn').style.display = 'none';
    qs('#tabPaymentsBtn').style.display = 'none';
    qs('#tabClearanceBtn').className = 'soft-btn';
    qs('#tabPaymentsBtn').className = 'primary-btn';
}

function bindActions(){
  document.addEventListener('click',e=>{
      const cv=e.target.closest('[data-company-view]'), ce=e.target.closest('[data-company-edit]'), cd=e.target.closest('[data-company-delete]'), oe=e.target.closest('[data-op-edit]'), od=e.target.closest('[data-op-delete]'), go=e.target.closest('[data-go]'), nav=e.target.closest('.nav-btn');
      if(cv) return viewCompanyDetails(cv.dataset.companyView);
      if(ce) return fillCompanyForm(ce.dataset.companyEdit);
      if(cd) return deleteCompany(cd.dataset.companyDelete);
      if(oe) return fillOperationForm(oe.dataset.opEdit);
      if(od) return deleteOperation(od.dataset.opDelete);
      if(go) return switchView(go.dataset.go);
      if(nav) return switchView(nav.dataset.target);
  });
  qs('#companyForm').addEventListener('submit',companyFormSubmit);
  qs('#companyFormReset').addEventListener('click',()=>{qs('#companyForm').reset();qs('#companyEditId').value='';});
  qs('#operationForm').addEventListener('submit',operationFormSubmit);
  qs('#resetOperationForm').addEventListener('click',clearOperationForm);
  qs('#clientName').addEventListener('change',syncClientCode);
  qs('#operationType').addEventListener('change',updateOperationTypeUI);
  ['containerCount','clearancePerContainer','extraReturns','extraYardFees','extraTruckFees'].forEach(id=>qs('#'+id).addEventListener('input',()=>recalcOperationFields('form')));
  qs('#profit').addEventListener('input',()=>{qs('#profit').dataset.manual='1';recalcOperationFields('profitManual');});
  qs('#billNo').addEventListener('input',syncPaymentLinkedData);
  qs('#clientName').addEventListener('change',syncPaymentLinkedData);
  qs('#companySearch').addEventListener('input',renderCompanies);
  qs('#operationSearch').addEventListener('input',renderOperations);
  qs('#operationFilterType').addEventListener('change',renderOperations);
  qs('#ledgerRefresh').addEventListener('click',renderLedger);
  qs('#ledgerCompanySelect').addEventListener('change',renderLedger);
  qs('#applyReportFilter').addEventListener('click',applyReportFilter);
  ['#reportCompanySelect','#reportTypeSelect','#reportFromDate','#reportToDate'].forEach(sel=>qs(sel).addEventListener('change',applyReportFilter));
  qs('#printLedgerBtn').addEventListener('click',()=>printSection('كشف حساب الشركة',qs('#ledgerSummary').outerHTML+qs('#ledgerTable').outerHTML));
  qs('#printReportBtn').addEventListener('click',()=>printSection('التقرير المفلتر',qs('#reportSummary').outerHTML+qs('#reportTable').outerHTML));
  qs('#printAllOperationsBtn').addEventListener('click',()=>printSection('كل العمليات',renderOperationsTable(state.operations,false)));
  qs('#printCompanyStatementBtn').addEventListener('click',quickPrintCompanyStatement);
  qs('#pdfLedgerBtn').addEventListener('click',()=>exportPdf('كشف_حساب',state.ledgerRows, '<div class="stats-grid">'+qs('#ledgerSummary').innerHTML+'</div>' + renderLedgerLikeTable(state.ledgerRows)));
  qs('#pdfReportBtn').addEventListener('click',()=>exportPdf('تقرير',state.reportRows, '<div class="stats-grid">'+qs('#reportSummary').innerHTML+'</div>' + renderOperationsTable(state.reportRows,false)));
  qs('#pdfAllOperationsBtn').addEventListener('click',()=>exportPdf('كل_العمليات',state.operations, renderOperationsTable(state.operations,false)));
  qs('#pdfCompanyStatementBtn').addEventListener('click',quickPdfCompanyStatement);
  qs('#exportJsonBtn').addEventListener('click',exportJsonBackup);
  qs('#invoiceReportBtn').addEventListener('click', renderInvoice);
  qs('#printInvoiceBtn').addEventListener('click', () => printSection('فاتورة حساب - ' + qs('#reportCompanySelect').value, '<div style="margin-bottom:20px; text-align:center; font-weight:bold; font-size: 24px;">م فاتورة حساب</div><div style="font-weight:bold; margin-bottom: 20px;">الشركة: '+qs('#reportCompanySelect').value+'</div>' + qs('#invoiceArea').innerHTML));
  qs('#pdfInvoiceBtn').addEventListener('click', () => exportPdf('فاتورة_حساب_' + qs('#reportCompanySelect').value, null, '<div style="margin-bottom:20px; text-align:center; font-weight:bold; font-size: 24px;">م فاتورة حساب</div><div style="font-weight:bold; margin-bottom: 20px;">الشركة: '+qs('#reportCompanySelect').value+'</div>' + qs('#invoiceArea').innerHTML));
  if(qs('#manualInvoiceBtn')) qs('#manualInvoiceBtn').addEventListener('click', renderManualInvoice);
  if(qs('#printManualInvoiceBtn')) qs('#printManualInvoiceBtn').addEventListener('click', () => {
    let cloned = qs('#manualInvoiceArea').cloneNode(true);
    let origInputs = qs('#manualInvoiceArea').querySelectorAll('input');
    cloned.querySelectorAll('input').forEach((inp, i) => { inp.outerHTML = `<span>${origInputs[i].value}</span>`; });
    printSection('فاتورة يدوية - ' + qs('#reportCompanySelect').value, '<div style="margin-bottom:20px; text-align:center; font-weight:bold; font-size: 24px;">م فاتورة حساب</div><div style="font-weight:bold; margin-bottom: 20px;">الشركة: '+qs('#reportCompanySelect').value+'</div>' + cloned.innerHTML);
  });
  if(qs('#pdfManualInvoiceBtn')) qs('#pdfManualInvoiceBtn').addEventListener('click', () => {
    let cloned = qs('#manualInvoiceArea').cloneNode(true);
    let origInputs = qs('#manualInvoiceArea').querySelectorAll('input');
    cloned.querySelectorAll('input').forEach((inp, i) => { inp.outerHTML = `<span>${origInputs[i].value}</span>`; });
    exportPdf('فاتورة_يدوية_' + qs('#reportCompanySelect').value, null, '<div style="margin-bottom:20px; text-align:center; font-weight:bold; font-size: 24px;">م فاتورة حساب</div><div style="font-weight:bold; margin-bottom: 20px;">الشركة: '+qs('#reportCompanySelect').value+'</div>' + cloned.innerHTML);
  });
  qs('#importJsonInput').addEventListener('change',importJsonBackup);
  qs('#seedResetBtn').addEventListener('click',resetToSeed);
  qs('#themeToggle').addEventListener('click',toggleTheme);
  qs('#tabClearanceBtn').addEventListener('click', showClearanceTab);
  qs('#tabPaymentsBtn').addEventListener('click', showPaymentsTab);
  qs('#closeCompanyDetailsBtn').addEventListener('click', () => { qs('#companyDetailsContainer').style.display = 'none'; });
}
function init(){loadState();bindActions();applyTheme();refreshAll();clearOperationForm();if(state.clients[0]){qs('#ledgerCompanySelect').value=state.clients[0].name;qs('#quickPrintCompanySelect').value=state.clients[0].name;}renderLedger();applyReportFilter();}document.addEventListener('DOMContentLoaded',init);

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  let pwaBanner = document.getElementById('installPrompt');
  if(pwaBanner && !sessionStorage.getItem('pwaDismissed')){
    pwaBanner.style.display = 'block';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('installAppBtn');
  const closeInstall = document.getElementById('closeInstallPromptBtn');
  if(installBtn) {
    installBtn.addEventListener('click', async () => {
      document.getElementById('installPrompt').style.display = 'none';
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
    });
  }
  if(closeInstall) {
    closeInstall.addEventListener('click', () => {
      document.getElementById('installPrompt').style.display = 'none';
      sessionStorage.setItem('pwaDismissed', 'true');
    });
  }

  // Passcode Check
  const passcodeOverlay = document.getElementById('passcodeOverlay');
  const btn = document.getElementById('passcodeBtn');
  const inp = document.getElementById('passcodeInput');
  const err = document.getElementById('passcodeError');
  if (sessionStorage.getItem('auth1001') === 'true') {
     if (passcodeOverlay) passcodeOverlay.style.display = 'none';
  }
  if (btn && inp && err) {
    btn.addEventListener('click', () => {
      if (inp.value === '1001') {
        sessionStorage.setItem('auth1001', 'true');
        passcodeOverlay.style.display = 'none';
      } else {
        err.style.display = 'block';
      }
    });
  }
});
