const charts = {};
let chartInstances = {};

const DELAY_COLORS = {
  // Keys exactly match normDelay() output
  'MAINTENANCE BREAKDOWN':       '#ff3b5c',
  'MAINTENANCE DAILY CHECKLIST': '#ff6b2b',
  'COIL FEEDING DELAY':          '#00c8ff',
  'PACKAGING DELAY':             '#ffd94a',
  'QUALITY DELAY':               '#a78bfa',
  'OPERATION DELAY':             '#34d399',
  'CRANE DELAY':                 '#f97316',
  'SETUP DELAY':                 '#06b6d4',
  'SCRAP REMOVAL':               '#84cc16',
  'SHIFT HANDOVER':              '#6b7280',
  'TBT':                         '#9ca3af',
  'COMMUNICATION DELAY':         '#8b5cf6',
  'HR DELAY':                    '#ec4899',
  'SCHEDULE DELAY':              '#60a5fa',
  'OTHER':                       '#64748b',
};

function delayColor(t){ return DELAY_COLORS[t]||'#3b82f6'; }

const MACHINES = ['WCTL-1','WCTL-2','SLITTER'];
const MCOLORS = {'WCTL-1':'#00c8ff','WCTL-2':'#ff6b2b','SLITTER':'#00e5a0'};

// ═══ CHART HELPER ═══
function mkChart(id,config){
  const existing = chartInstances[id];
  const type = config.type || 'bar';
  config.type = type;
  if(existing && existing.config.type === type){
    existing.data = config.data;
    existing.options = config.options;
    existing.update();
    return existing;
  }
  if(existing){existing.destroy();}
  const ctx=document.getElementById(id);
  if(!ctx) return;
  chartInstances[id]=new Chart(ctx,config);
  return chartInstances[id];
}

const C={
  gridLine:'rgba(26,45,74,0.8)',
  tickColor:'#5a7898',
  legendColor:'#e0eeff',
};

function baseOpts(title=''){
  return {
    responsive:true,maintainAspectRatio:false,
    plugins:{
      legend:{labels:{color:C.legendColor,font:{family:'Barlow',size:11}}},
      tooltip:{backgroundColor:'#0c1525',borderColor:'#1a2d4a',borderWidth:1,titleColor:'#00c8ff',bodyColor:'#e0eeff',titleFont:{family:'Rajdhani',size:13,weight:'700'}},
      title:title?{display:false}:{display:false},
    },
    scales:{
      x:{grid:{color:C.gridLine},ticks:{color:C.tickColor,font:{family:'JetBrains Mono',size:10}}},
      y:{grid:{color:C.gridLine},ticks:{color:C.tickColor,font:{family:'JetBrains Mono',size:10}}},
    }
  };
}

function toggleLine(btn,chartId){
  btn.classList.toggle('on');
  const chart=chartInstances[chartId];
  if(!chart) return;
  const m=btn.dataset.m;
  const idx=MACHINES.indexOf(m);
  const meta=chart.getDatasetMeta(idx);
  meta.hidden=!meta.hidden;
  chart.update();
}
