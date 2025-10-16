const REPORT_TITLE_MAP = {
  'daily-distance':'Travel Path Report',
  'odometer-daily-distance':'Distance Report',
  'distance-speed-range':'Speed Report',
  'stoppage':'Stoppage Report',
  'idle':'Idle Report',
  'ignition':'Ignition Report',
  'daily':'Daily Report',
  'panic':'Panic Report'
};

const MAX_CUSTOM_RANGE_MS = 30 * 24 * 60 * 60 * 1000;

let recentPollTimer = null;

function toAmPm(dtStr){
  if(!dtStr) return '';
  const d = new Date(dtStr);
  if(isNaN(d)) return '';
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2,'0');
  const ampm = h >= 12 ? 'PM':'AM';
  h = h % 12;
  if(h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function isCustomSelected(){
  return (getSelectOrNativeValue('dateRange') || '').toLowerCase() === 'custom';
}

function getSelectOrNativeValue(id){
  const el = document.getElementById(id);
  if (!el) return '';
  const inst = (window.jQuery && $('#' + id)[0]) ? $('#' + id)[0].selectize : null;
  if (inst) return inst.getValue();
  return el.value || '';
}

function validateCustomRange(showFlash = true){
  if (!isCustomSelected()) {
    return true;
  }

  const fromISO = buildISOFromParts('fromDate');
  const toISO   = buildISOFromParts('toDate');

  let msg = '';
  if (!fromISO || !toISO) {
    msg = 'Please select both From and To date & time';
  } else {
    const from = new Date(fromISO);
    const to   = new Date(toISO);
    const now  = new Date();
    if (isNaN(from) || isNaN(to)) {
      msg = 'Invalid custom date/time';
    } else if (to > now) {
      msg = 'To date cannot be in the future';
    } else if (from > now) {
      msg = 'From date cannot be in the future';
    } else if (from > to) {
      msg = 'From date cannot be after To date';
    } else if ((to - from) > MAX_CUSTOM_RANGE_MS) {
      msg = 'Maximum custom range is 30 days';
    } else {
      const earliest = new Date(now.getTime() - MAX_CUSTOM_RANGE_MS);
      if (from < earliest) {
        msg = 'From date cannot be older than 30 days';
      }
    }
  }

  const valid = msg === '';

  if (!valid && showFlash) {
    displayFlashMessage(msg, 'warning');
  }
  return valid;
}

function getSelectizeInst(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  if (el.selectize) return el.selectize; 
  const jq = window.jQuery && window.jQuery('#' + id)[0];
  return jq && jq.selectize ? jq.selectize : null;
}

function getSelectValue(id) {
  const inst = getSelectizeInst(id);
  if (inst) return inst.getValue();
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setSelectValue(id, val) {
  const inst = getSelectizeInst(id);
  if (inst) {
    inst.setValue(val, true);
  } else {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

function setCompositeFromDate(prefix, dateObj){
  // prefix: 'fromDate' | 'toDate'
  const pad=n=>n.toString().padStart(2,'0');
  const dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth()+1)}-${pad(dateObj.getDate())}`;
  let h24 = dateObj.getHours();
  let ampm = h24>=12?'PM':'AM';
  let h12 = h24%12; if(h12===0) h12=12;
  const min = pad(dateObj.getMinutes());
  const dateEl = document.getElementById(prefix+'Date');
  if (dateEl) dateEl.value = dateStr;
  setSelectValue(prefix+'Hour', pad(h12));
  setSelectValue(prefix+'Minute', min);
  setSelectValue(prefix+'AmPm', ampm);
  syncHiddenInputs();
}

function clampCustomRange(){
  // If any part is missing, set defaults first
  const needDefaults =
    !document.getElementById('fromDateDate').value ||
    !getSelectValue('fromDateHour') ||
    !getSelectValue('fromDateMinute') ||
    !getSelectValue('fromDateAmPm') ||
    !document.getElementById('toDateDate').value ||
    !getSelectValue('toDateHour') ||
    !getSelectValue('toDateMinute') ||
    !getSelectValue('toDateAmPm');

  if (needDefaults) setDefaultCustom();

  syncHiddenInputs();
  const fromHidden = document.getElementById('fromDate').value;
  const toHidden = document.getElementById('toDate').value;
  if(!fromHidden || !toHidden) {
    displayFlashMessage('Invalid custom date/time','danger');
    return false;
  }
  let from = new Date(fromHidden);
  let to   = new Date(toHidden);
  if(isNaN(from)||isNaN(to)){
    displayFlashMessage('Invalid custom date/time','danger');
    return false;
  }

  const now = new Date();
  // Force "to" not in future
  if (to > now) {
    to = now;
    setCompositeFromDate('toDate', to);
    displayFlashMessage('To date cannot be in the future','warning');
  }
  // Also prevent "from" in future
  if (from > now) {
    from = now;
    setCompositeFromDate('fromDate', from);
    displayFlashMessage('From date cannot be in the future','warning');
  }

  if(from > to){
    from = new Date(to);
    setCompositeFromDate('fromDate', from);
    displayFlashMessage('From date adjusted (cannot exceed To)','warning');
  }
  if((to - from) > MAX_CUSTOM_RANGE_MS){
    from = new Date(to.getTime() - MAX_CUSTOM_RANGE_MS);
    setCompositeFromDate('fromDate', from);
    displayFlashMessage('Custom range capped at 30 days','warning');
  }
  const earliest = new Date(now.getTime() - MAX_CUSTOM_RANGE_MS);
  if(from < earliest){
    from = earliest;
    setCompositeFromDate('fromDate', from);
    displayFlashMessage('From date cannot be older than 30 days','warning');
  }

  syncHiddenInputs();
  return true;
}
function buildISOFromParts(prefix){
  const date = document.getElementById(prefix+'Date').value;
  const hour12 = getSelectValue(prefix+'Hour') || '12';
  const minute = getSelectValue(prefix+'Minute') || '00';
  const ampm = getSelectValue(prefix+'AmPm') || 'AM';
  if(!date) return '';
  let h = parseInt(hour12,10);
  if (isNaN(h)) h = 12;
  if(ampm === 'PM' && h !== 12) h += 12;
  if(ampm === 'AM' && h === 12) h = 0;
  const hh = h.toString().padStart(2,'0');
  return `${date}T${hh}:${minute}`;
}

function syncHiddenInputs(){
  const fromISO = buildISOFromParts('fromDate');
  const toISO = buildISOFromParts('toDate');
  if(fromISO) document.getElementById('fromDate').value = fromISO;
  if(toISO) document.getElementById('toDate').value = toISO;
}

function parseLocal(dtStr){
  if(!dtStr) return null;
  const d = new Date(dtStr.replace('T',' ') + ':00');
  return isNaN(d)?null:d;
}

function downloadReport(reportId){
  fetch(`/reports/download_report/${reportId}`,{
    headers:{'X-CSRF-TOKEN':getCookie('csrf_access_token')}
  }).then(resp=>{
    if(!resp.ok)return resp.json().then(j=>{throw new Error(j.message||'Download failed')});
    return resp.blob();
  }).then(blob=>{
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='report.xlsx';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }).catch(e=>displayFlashMessage(e.message,'danger'));
}

function openStoredReport(id){
  fetch(`/reports/view_report/${id}`,{
    headers:{'X-CSRF-TOKEN':getCookie('csrf_access_token')}
  }).then(r=>r.json())
    .then(js=>{
      if(!js.success){
        displayFlashMessage(js.message||'Unable to load report','danger');
        return;
      }
      openPreview(js.metadata.report_name, js.data||[]);
    }).catch(e=>console.error(e));
}


function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
}

function loadRecentReports(range){
  fetch(`/reports/get_recent_reports?range=${range}`)
    .then(r=>r.json())
    .then(d=>{
      if(d.success){
        renderRecentReports(d.reports || []);
        const hasInProgress = (d.reports || []).some(r => r.status === 'IN_PROGRESS');
        if (hasInProgress && !recentPollTimer) {
          recentPollTimer = setInterval(()=>{
            const current = document.getElementById('reportDateRange')?.value || 'today';
            loadRecentReports(current);
          }, 2000);
        } else if (!hasInProgress && recentPollTimer){
          clearInterval(recentPollTimer); recentPollTimer = null;
        }
      } else {
        document.getElementById('recentReportsList').innerHTML='<p>Your generated reports will be visible here.</p>';
      }
    });
}

function renderRecentReports(reports){
  const c=document.getElementById('recentReportsList');
  c.innerHTML='';
  if(!reports.length){
    c.innerHTML = '<p class="no-reports">No reports found for selected range.</p>';
    return;
  }
  reports.forEach(r=>{
    const isSuccess = r.status === 'SUCCESS';
    const isFail = r.status === 'FAILURE';
    const isProgress = r.status === 'IN_PROGRESS';
    const sizeKB = r.size ? (r.size/1024).toFixed(1)+' KB' : '—';
    const genTime = r.generated_at ? new Date(r.generated_at) : (r.created_at ? new Date(r.created_at) : null);
    const fromStr = r.range_start_utc ? new Date(r.range_start_utc).toLocaleString() : '—';
    const toStr = r.range_end_utc ? new Date(r.range_end_utc).toLocaleString() : '—';
    const statusBadge = isSuccess ? '<span class="statusBadge badge-success">Ready</span>' :
                         isFail ? '<span class="statusBadge badge-fail">Failed</span>' :
                         `<span class="statusBadge badge-progress">In&nbsp;progress</span>`;

    const progressBar = isProgress ? `
      <div class="progress-wrap">
        <div class="progress-bar" style="width:${Math.max(5, r.progress||0)}%"></div>
        <span class="progress-text">${r.progress||0}%</span>
      </div>` : '';

    const err = isFail && r.error_message ? `<div class="error-text" title="${r.error_message}">${r.error_message}</div>` : '';

    const div=document.createElement('div');
    div.className='report-item'+(isProgress?' in-progress':'')+(isFail?' failed':'');
    div.innerHTML=`
      <div class="report-status">${statusBadge}</div>
      <div class="report-info ${isSuccess ? 'report-open' : ''}" ${isSuccess ? `data-id="${r._id}"` : ''}>
        <div class="report-name">${r.report_name}</div>
        <div class="report-meta">
          <div class="meta-row two">
            <span class="meta-item"><b>Vehicle:</b> ${r.vehicle_number || '—'}</span>
            <span class="meta-item"><b>Size:</b> ${sizeKB}</span>
          </div>
          <div class="meta-row two">
            <span class="meta-item"><b>From:</b> ${fromStr}</span>
            <span class="meta-item"><b>To:</b> ${toStr}</span>
          </div>
          ${genTime ? `
          <div class="meta-row one">
            <span class="meta-item"><b>${isSuccess?'Generated':'Created'}:</b> ${formatTimeAgo(genTime)}</span>
          </div>` : ''}
        </div>
        ${progressBar}
        ${err}
      </div>
      <div class="report-actions">
        <button title="Download" ${isSuccess?'':'disabled'} onclick="downloadReport('${r._id}')"><i class="fas fa-download"></i></button>
      </div>`;
    c.appendChild(div);
  });
  c.querySelectorAll('.report-open').forEach(el=>{
    el.addEventListener('click',()=>openStoredReport(el.dataset.id));
  });
}

function buildTable(rows){
  if(!rows.length)return '<p>No data.</p>';
  const headers=Object.keys(rows[0]);
  const thead=`<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody=`<tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td>${r[h]??''}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<table class="table table-bordered table-striped">${thead}${tbody}</table>`;
}

function openPreview(title, rows){
  document.getElementById('reportPreviewModalTitle').textContent=title+' Preview';
  document.getElementById('reportPreviewTableContainer').innerHTML=buildTable(rows);
  document.getElementById('reportPreviewModal').style.display='block';
}

function queueReport(){
  const reportType=document.getElementById('generateReport').dataset.reportType;
  const vehicleNumber=document.getElementById('vehicleNumber').value;
  const dateRange=getSelectOrNativeValue('dateRange');

  if(dateRange === 'custom'){
    syncHiddenInputs();
    if(!validateCustomRange(true)) {
      displayFlashMessage('Invalid custom date range. Please fix and try again.','warning');
      return;
    }
  }

  if(!vehicleNumber){
    displayFlashMessage('Select a vehicle first','warning');
    return;
  }

  const btn=document.getElementById('generateReport');
  const prog=document.getElementById('asyncProgress');
  const progText=document.getElementById('asyncProgressText');
  btn.disabled=true; btn.textContent='Queuing...';
  prog.style.display='block'; progText.textContent='0%';

  const body={reportType,vehicleNumber,dateRange};
  if(dateRange==='custom'){
    body.fromDate=document.getElementById('fromDate').value;
    body.toDate=document.getElementById('toDate').value;
  }

  fetch('/reports/generate_report',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-CSRF-TOKEN':getCookie('csrf_access_token')},
    body:JSON.stringify(body)
  }).then(r=>r.json()).then(js=>{
    if(!js.success){
      displayFlashMessage(js.message||'Failed to queue report','danger');
      reset();
      return;
    }
    pollStatus(js.task_id,btn,prog,progText,reportType);
  }).catch(e=>{
    console.error(e);
    displayFlashMessage('Queue failed','danger');
    reset();
  });
  function reset(){
    btn.disabled=false; btn.textContent='Generate Report'; prog.style.display='none';
  }
}

function pollStatus(taskId,btn,prog,progText,reportType){
  const iv=setInterval(()=>{
    fetch(`/reports/report_status/${taskId}`,{headers:{'X-CSRF-TOKEN':getCookie('csrf_access_token')}})
      .then(r=>r.json())
      .then(js=>{
        if(js.state==='PENDING'||js.state==='STARTED'){
          progText.textContent = js.progress ? `${js.progress}%` : '...';
        }else if(js.state==='SUCCESS'){
          clearInterval(iv);
          progText.textContent='Done';
          setTimeout(()=>{prog.style.display='none';},800);
          btn.disabled=false; btn.textContent='Generate Report';
          loadRecentReports(document.getElementById('reportDateRange').value||'today');
        }else if(js.state==='FAILURE'){
          clearInterval(iv);
          displayFlashMessage(js.error||'Failed','danger');
          btn.disabled=false; btn.textContent='Generate Report';
          prog.style.display='none';
        }
      }).catch(e=>{console.error(e);});
  },1500);
}

function setDefaultCustom(){
  const now = new Date();
  const oneHourAgo = new Date(now.getTime()-3600*1000);
  setCompositeFromDate('toDate', now);
  setCompositeFromDate('fromDate', oneHourAgo);
}

function applySelectize(){
  const selIds = [
    '#dateRange','#subUserName','#vehicleNumber',
    '#fromDateHour','#fromDateMinute','#fromDateAmPm',
    '#toDateHour','#toDateMinute','#toDateAmPm', '#reportDateRange'
  ];
  selIds.forEach(id=>{
    const el = document.querySelector(id);
    if(!el) return;
    // Skip if already initialized by Selectize
    const inst = window.jQuery && $(el)[0] && $(el)[0].selectize;
    if (inst) return;
    $(el).selectize({
      create:false,
      sortField:'text',
      searchField:['text']
    });
  });
}

function toggleCustomDateRange(val){
  const v = (val || '').toLowerCase();
  const custom = document.getElementById('customDateRange');
  if(!custom) return;
  if(v === 'custom'){
    custom.style.display='block';
    if(!document.getElementById('fromDate').value || !document.getElementById('toDate').value){
      setDefaultCustom();
    }
  }else{
    custom.style.display='none';
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  applySelectize();

  function bindReportRangeChange(){
    const sel = document.getElementById('reportDateRange');
    const inst = window.jQuery && $('#reportDateRange')[0] ? $('#reportDateRange')[0].selectize : null;

    if (inst && !bindReportRangeChange._boundToSelectize) {
      inst.on('change', (val)=> loadRecentReports(val || 'today'));
      bindReportRangeChange._boundToSelectize = true;
    }

    if (sel && !bindReportRangeChange._boundToNative) {
      sel.addEventListener('change', function(){ loadRecentReports(this.value || 'today'); });
      bindReportRangeChange._boundToNative = true;
    }
  }
  bindReportRangeChange();

  const toggleEl = document.getElementById('reportsToggle');
  if (toggleEl) {
    const genOpt = toggleEl.querySelector('.generate-option');
    const recOpt = toggleEl.querySelector('.recent-option');
    const slider = toggleEl.querySelector('.slider-button');
    const genView = document.getElementById('generateReportsView');
    const recView = document.getElementById('recentReportsView');

    function setMode(mode){
      const isRecent = mode === 'recent';
      genOpt.classList.toggle('active', !isRecent);
      recOpt.classList.toggle('active', isRecent);
      slider.style.transform = isRecent ? 'translateX(100%)' : 'translateX(0%)';
      genView.classList.toggle('active', !isRecent);
      recView.classList.toggle('active', isRecent);
      if (isRecent) {
        // Rebind in case Selectize got initialized after DOMContentLoaded
        bindReportRangeChange();
        const range = (document.getElementById('reportDateRange')?.value) || 'today';
        loadRecentReports(range);
      }
    }

    genOpt?.addEventListener('click', ()=>setMode('generate'));
    recOpt?.addEventListener('click', ()=>setMode('recent'));
  }

  const drSel = document.getElementById('dateRange');
  const drInst = window.jQuery && $('#dateRange')[0] ? $('#dateRange')[0].selectize : null;

  if (drInst) {
    drInst.on('change', (val)=>{
      toggleCustomDateRange(val);
      validateCustomRange(false);
    });
    toggleCustomDateRange(drInst.getValue());
  } else if (drSel) {
    drSel.addEventListener('change', (e)=>{
      toggleCustomDateRange(e.target.value);
      validateCustomRange(false);
    });
    toggleCustomDateRange(drSel.value);
  }

  ['fromDateDate','fromDateHour','fromDateMinute','fromDateAmPm',
   'toDateDate','toDateHour','toDateMinute','toDateAmPm'
  ].forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      el.addEventListener('change',()=>{
        syncHiddenInputs();
        validateCustomRange(true);
      });
    }
  });

  loadRecentReports('today');
  document.querySelectorAll('.report-card').forEach(card=>{
    card.addEventListener('click',e=>{
      e.preventDefault();
      const type=card.dataset.report;
      const genBtn = document.getElementById('generateReport');
      if (genBtn) genBtn.dataset.reportType=type;
      const titleEl = document.getElementById('reportModalTitle') || document.querySelector('#reportModal h2');
      if (titleEl) titleEl.textContent = REPORT_TITLE_MAP[type]||'Report';
      document.getElementById('reportModal').style.display='block';

      const current = drInst ? drInst.getValue() : (drSel ? drSel.value : '');
      toggleCustomDateRange(current);
    });
  });

  const reportModalEl = document.getElementById('reportModal');
  if (reportModalEl) {
    reportModalEl.addEventListener('click', (e) => {
      if (e.target === reportModalEl) {
        reportModalEl.style.display = 'none';
      }
    });
  }

  document.getElementById('generateReport').addEventListener('click',e=>{
    e.preventDefault(); queueReport();
  });

  document.getElementById('closePreviewModal').addEventListener('click',()=>{
    document.getElementById('reportPreviewModal').style.display='none';
  });

  document.querySelectorAll('#cancelReportModal').forEach(c=>c.addEventListener('click',()=>{
    document.getElementById('reportModal').style.display='none';
  }));

  document.querySelectorAll('#reportModal .close').forEach(c=>c.addEventListener('click',()=>{
    document.getElementById('reportModal').style.display='none';
  }));

  loadRecentReports('today');
});

function createReportCard(report) {
  const existingCard = document.querySelector(
    `.report-card[data-report-name="${report.report_name}"]`
  );
  if (existingCard) return;

  const reportCard = document.createElement("a");
  reportCard.href = "#";
  reportCard.className = "report-card";
  reportCard.dataset.report = "custom";
  reportCard.dataset.reportName = report.report_name;
  reportCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <h3>${report.report_name}</h3>
      <i class="fa-solid fa-trash delete-report" title="Delete Report" style="color: #d9534f; cursor: pointer; font-size: 1.2em; margin-left: 8px;"></i>
    </div>
    <i class="fa-solid fa-file-alt" style="font-size: 2.5em; margin-top: 10px;"></i>
  `;

  reportCard.querySelector('.delete-report').addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    const reportName = reportCard.dataset.reportName || reportCard.querySelector('h3').textContent;
    showDeleteConfirm(reportName, function() {
      fetch(`/reports/delete_custom_report?name=${encodeURIComponent(reportName)}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-TOKEN": getCookie("csrf_access_token"),
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          reportCard.remove();
        } else {
          alert(data.message || "Failed to delete report.");
        }
      })
      .catch(() => alert("Failed to delete report."));
    });
  });

  const container = document.querySelector(".report-cards");
  container.insertBefore(reportCard, container.lastElementChild);
}

function openReportModal(reportName) {
  const modal = document.getElementById("reportModal");
  if (modal) {
    modal.querySelector("h2").textContent = reportName;
    modal.style.display = "block";
  }
}

async function generatePanicReport() {
  const vehicleNumber = document.getElementById("vehicleNumber").value;
  const dateRange = document.getElementById("dateRange").value;

  if (!vehicleNumber) {
    displayFlashMessage('Select a vehicle first','warning');
    return;
  }

  try {
    const response = await fetch("/reports/download_panic_report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": getCookie("csrf_access_token"),
      },
      body: JSON.stringify({
        vehicleNumber: vehicleNumber,
        dateRange: dateRange || "all",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      displayFlashMessage(errorData.message || "Failed to generate panic report", errorData.category || "danger");
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = vehicleNumber === "all"
      ? `panic_report_ALL_VEHICLES.xlsx`
      : `panic_report_${vehicleNumber}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    displayFlashMessage('Panic report download started','success');
  } catch (error) {
    console.error("Error:", error);
    displayFlashMessage(error.message || "Failed to generate panic report",'danger');
  }
}

function loadFields() {
  fetch("/reports/get_fields")
    .then((response) => {
      if (!response.ok) {
        displayFlashMessage("Failed to load fields","danger");
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((fields) => {
      if (typeof fieldSelection === 'undefined' || typeof allowedFields === 'undefined') {
        console.warn('Custom report field UI removed; loadFields skipped.');
        return;
      }
      fieldSelection.innerHTML = "";
      const filteredFields = fields.filter((field) =>
        allowedFields.includes(field)
      );
      filteredFields.forEach((field) => {
        const fieldItem = document.createElement("div");
        fieldItem.className = "field-item";
        fieldItem.style.cssText = `
          padding: 10px;
          margin: 5px;
          border: 1px solid #ccc;
          border-radius: 5px;
          background-color: #f9f9f9;
          cursor: pointer;
        `;
        fieldItem.innerHTML = `
          <input type="checkbox" id="${field}" value="${field}" />
          <label for="${field}" style="margin-left: 5px;">${field}</label>
        `;
        fieldSelection.appendChild(fieldItem);
      });
    })
    .catch((error) => {
      console.error("Error loading fields:", error);
      displayFlashMessage("Failed to load available fields","danger");
    });
}

document.getElementById("closePreviewModal").addEventListener("click", function () {
  document.getElementById("reportPreviewModal").style.display = "none";
});

let previewCurrentPage = 1;
let previewRowsPerPage = 50;
let previewTotalRows = 0;
let previewReportId = null;

function renderPreviewPagination() {
  const container = document.getElementById('reportPreviewTableContainer');
  if (!container || previewTotalRows <= previewRowsPerPage) return;

  const totalPages = Math.ceil(previewTotalRows / previewRowsPerPage);
  let html = `
    <div class="pagination-container" style="margin-top:16px;">
      <button id="previewPrevPage" ${previewCurrentPage === 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${previewCurrentPage} of ${totalPages}</span>
      <button id="previewNextPage" ${previewCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
      <span style="margin-left:16px;">Rows per page:</span>
      <select id="previewRowsPerPage">
        <option value="10" ${previewRowsPerPage==10?'selected':''}>10</option>
        <option value="25" ${previewRowsPerPage==25?'selected':''}>25</option>
        <option value="50" ${previewRowsPerPage==50?'selected':''}>50</option>
        <option value="100" ${previewRowsPerPage==100?'selected':''}>100</option>
      </select>
      <span style="margin-left:16px;">Total: ${previewTotalRows}</span>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = html;
  container.appendChild(div);

  document.getElementById('previewPrevPage').onclick = function() {
    if (previewCurrentPage > 1) loadReportPreviewPage(previewReportId, previewCurrentPage - 1, previewRowsPerPage);
  };
  document.getElementById('previewNextPage').onclick = function() {
    if (previewCurrentPage < totalPages) loadReportPreviewPage(previewReportId, previewCurrentPage + 1, previewRowsPerPage);
  };
  document.getElementById('previewRowsPerPage').onchange = function() {
    previewRowsPerPage = parseInt(this.value);
    loadReportPreviewPage(previewReportId, 1, previewRowsPerPage);
  };
}

function loadReportPreviewPage(reportId, page, perPage) {
  previewReportId = reportId;
  previewCurrentPage = page;
  previewRowsPerPage = perPage;
  fetch(`/reports/view_report/${reportId}?page=${page}&per_page=${perPage}`, {
    headers: {'X-CSRF-TOKEN': getCookie('csrf_access_token')}
  })
    .then(r => r.json())
    .then(js => {
      if (!js.success) {
        displayFlashMessage(js.message || 'Unable to load report', 'danger');
        return;
      }
      previewTotalRows = js.total || 0;
      openPreview(js.metadata.report_name, js.data || []);
      renderPreviewPagination();
    }).catch(e => console.error(e));
}

// Update openStoredReport to use paginated preview
function openStoredReport(id) {
  loadReportPreviewPage(id, previewCurrentPage, previewRowsPerPage);
}

// Update openPreview to not reset pagination controls
function openPreview(title, rows) {
  document.getElementById('reportPreviewModalTitle').textContent = title + ' Report Preview';
  document.getElementById('reportPreviewTableContainer').innerHTML = buildTable(rows);
  document.getElementById('reportPreviewModal').style.display = 'block';
}