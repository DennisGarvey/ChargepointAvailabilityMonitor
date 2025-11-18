const API_BASE = 'https://mc.chargepoint.com/map-prod/v3/station/info?deviceId=';
const POLL_INTERVAL_MS = 60000;
let stations = [];

function parseStationsParam(){
  const urlParams = new URLSearchParams(window.location.search);
  const raw = urlParams.get('stations');
  if(!raw) return [];
  return raw.split(/[;,\s]+/).filter(x=>/^\d+$/.test(x));
}

async function fetchStation(id){
  const endpoint = API_BASE + id;
  const resp = await fetch(endpoint, {cache:'no-store'});
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  return await resp.json();
}

function classify(statusRaw){
  const s = (statusRaw||'unknown').toLowerCase();
  if(s==='in_use') return {text:'In Use', badge:'in-use', state:'Online', emoji:'🟢'};
  if(s==='available') return {text:'Available', badge:'available', state:'Online', emoji:'🟢'};
  if(['unreachable','unavailable','maintenance_required'].includes(s))
    return {text:s.replace(/_/g,' ').replace('maintenance required','Maintenance Req.'), badge:'offline', state:'Offline', emoji:'🔴'};
  return {text:s.replace(/_/g,' ').toUpperCase(), badge:'offline', state:'Offline', emoji:'🔴'};
}

function buildTable(stationsData){
  const tbody = document.getElementById('tbody');
  tbody.innerHTML='';
  stationsData.forEach(st => {
    const ports = st?.portsInfo?.ports || [];
    const name = (st.name||[]).join(' ');
    const model = st.modelNumber || 'Unknown';
    const sw = st.deviceSoftwareVersion || 'Unknown';
    const sid = st.deviceId;
    ports.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.className='station-row';
      tr.dataset.station = sid;
      tr.addEventListener('mouseenter', () => {
        document.querySelectorAll(`tr.station-row[data-station='${sid}']`).forEach(r => r.classList.add('station-hover'));
      });
      tr.addEventListener('mouseleave', () => {
        document.querySelectorAll(`tr.station-row[data-station='${sid}']`).forEach(r => r.classList.remove('station-hover'));
      });
      if(idx===0){
        const tdName=document.createElement('td'); tdName.rowSpan=ports.length; tdName.innerHTML=`<a class='station-link' target='_blank' href='https://driver.chargepoint.com/stations/${sid}'>${name}</a>`; tr.appendChild(tdName);
        const tdId=document.createElement('td'); tdId.rowSpan=ports.length; tdId.textContent=sid; tr.appendChild(tdId);
      }
      const cls = classify(p.statusV2 || p.status);
      const tdPort=document.createElement('td'); tdPort.textContent='Port '+p.outletNumber; tr.appendChild(tdPort);
      const tdStatus=document.createElement('td'); tdStatus.innerHTML=`<span class='status-badge badge-${cls.badge}'>${cls.text}</span>`; tr.appendChild(tdStatus);
      const tdState=document.createElement('td'); tdState.textContent=`${cls.emoji} ${cls.state}`; tr.appendChild(tdState);
      if(idx===0){
        const tdModel=document.createElement('td'); tdModel.rowSpan=ports.length; tdModel.textContent=model; tr.appendChild(tdModel);
        const tdSw=document.createElement('td'); tdSw.rowSpan=ports.length; tdSw.textContent=sw; tr.appendChild(tdSw);
      }
      tbody.appendChild(tr);
    });
  });
  document.getElementById('lastUpdate').textContent = new Date().toLocaleString();
}

async function refresh(){
  const statusEl = document.getElementById('status');
  const errEl = document.getElementById('error');
  errEl.textContent='';
  statusEl.textContent='Loading…';
  if(stations.length===0){ statusEl.textContent='Add ?stations=ID1,ID2'; return; }
  const collected=[];
  for(const id of stations){
    try {
      const data = await fetchStation(id);
      collected.push(data);
    } catch(e){
      errEl.textContent += `Failed ${id}: ${e.message}\n`;
    }
  }
  buildTable(collected);
  statusEl.textContent = collected.length? '':'No data';
}

function init(){
  stations = parseStationsParam();
  refresh();
  setInterval(refresh, POLL_INTERVAL_MS);
}

document.addEventListener('DOMContentLoaded', init);
