const toast = document.querySelector('#toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

const defaultCode = `// мигаем светодиодом на пине 13\nconst int ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  delay(1000);\n  digitalWrite(ledPin, LOW);\n  delay(1000);\n}`;
const defaultProject = { id: 'workspace-default', name: 'Новая схема', board: 'Arduino Uno', parts: [], connections: [], code: localStorage.getItem('circuitlab-default-code') || defaultCode };
let projects = readProjects();
let activeProject = defaultProject;
const canvas = document.querySelector('#canvas-grid');
const componentLayer = document.querySelector('#placed-components');
const codeEditor = document.querySelector('#code-editor');
const projectGrid = document.querySelector('#project-grid');
const projectModal = document.querySelector('#new-project-modal');
const projectForm = document.querySelector('#project-form');

function readProjects() {
  try {
    const value = JSON.parse(localStorage.getItem('circuitlab-projects') || '[]');
    return Array.isArray(value) ? value.filter((p) => p && p.id && p.name).map((p) => ({ ...p, parts: Array.isArray(p.parts) ? p.parts.map((part, index) => ({ ...part, id: part.id || `part-${p.id}-${index}` })) : [], connections: Array.isArray(p.connections) ? p.connections : [], code: typeof p.code === 'string' ? p.code : defaultCode })) : [];
  } catch { return []; }
}
function persistProjects() { localStorage.setItem('circuitlab-projects', JSON.stringify(projects)); }
function saveActiveProject() {
  if (activeProject.id === defaultProject.id) {
    localStorage.setItem('circuitlab-default-code', activeProject.code);
    return;
  }
  const index = projects.findIndex((item) => item.id === activeProject.id);
  if (index >= 0) projects[index] = { ...activeProject, updatedAt: new Date().toISOString() };
  persistProjects();
}

function updateProjectCount() {
  document.querySelector('.stats-grid .stat-number').textContent = String(3 + projects.length);
  document.querySelector('.nav-count').textContent = String(projects.length + 3);
  document.querySelectorAll('.stats-grid .stat-number')[1].textContent = String(document.querySelectorAll('.component-row').length);
}
function renderProjects() {
  projectGrid.querySelectorAll('.created-project').forEach((card) => card.remove());
  for (const project of projects) {
    const card = document.createElement('article');
    card.className = 'project-card created-project';
    card.dataset.projectId = project.id;
    card.innerHTML = `<div class="project-art"><span class="created-art-symbol">⌘</span><span class="art-caption">МОЯ СХЕМА</span></div><div class="project-info"><div class="project-title-row"><h3></h3><button class="more-button project-menu" type="button" aria-label="Удалить проект" title="Удалить проект">···</button></div><p></p><div class="project-meta"><span class="project-status in-progress"><i></i>Мой проект</span><span></span></div><div class="project-tags"><span>DIY</span><span>${project.parts.length} компонентов</span></div></div>`;
    card.querySelector('h3').textContent = project.name;
    card.querySelector('.project-info > p').textContent = project.description || 'Личный проект в моей мастерской';
    card.querySelector('.project-meta > span:last-child').textContent = formatDate(project.updatedAt || project.createdAt);
    card.querySelector('.project-tags span:first-child').textContent = project.board || 'DIY';
    if (project.id === activeProject.id) card.classList.add('is-active');
    card.addEventListener('click', (event) => {
      if (event.target.closest('.project-menu')) {
        event.stopPropagation();
        deleteProject(project.id);
        return;
      }
      activateProject(project.id);
      document.querySelector('#workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    projectGrid.append(card);
  }
  updateProjectCount();
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function formatDate(value) {
  if (!value) return 'Только что';
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(new Date(value));
}
function activateProject(id) {
  const project = id === defaultProject.id ? defaultProject : projects.find((item) => item.id === id);
  if (!project) return;
  saveActiveProject();
  activeProject = project;
  document.querySelector('#active-project-name').textContent = project.name;
  codeEditor.value = project.code || defaultCode;
  canvas.classList.toggle('user-project', project.id !== defaultProject.id);
  renderParts();
  renderProjects();
  localStorage.setItem('circuitlab-active-project', project.id);
}

const pinMap = {
  board: ['GND', '5V', '3V3', 'D2', 'D3', 'D13', 'A0', 'A1'], nano: ['GND', '5V', 'D2', 'D3', 'D13', 'A0'],
  esp32: ['GND', '3V3', 'VIN', 'GPIO18', 'GPIO19', 'GPIO21', 'GPIO22', 'GPIO23'], pico: ['GND', '3V3', 'VBUS', 'GP0', 'GP1', 'GP2', 'GP3', 'GP4'],
  tp4056: ['B+', 'B−', 'OUT+', 'OUT−'], led: ['A', 'K'], 'rgb-led': ['R', 'G', 'B', '+'], resistor: ['1', '2'],
  sensor: ['VCC', 'DATA', 'GND'], dht22: ['VCC', 'DATA', 'GND'], ultrasonic: ['VCC', 'TRIG', 'ECHO', 'GND'],
  ldr: ['VCC', 'SIG', 'GND'], bmp280: ['VCC', 'GND', 'SDA', 'SCL'], lm35: ['VCC', 'OUT', 'GND'], pir: ['VCC', 'OUT', 'GND'],
  gas: ['VCC', 'AOUT', 'DOUT', 'GND'], hall: ['VCC', 'OUT', 'GND'], soil: ['VCC', 'SIG', 'GND'], microphone: ['VCC', 'OUT', 'GND'],
  'current-sensor': ['IP+', 'IP−', 'VCC', 'OUT', 'GND'], oled: ['VCC', 'GND', 'SDA', 'SCL'], lcd1602: ['VCC', 'GND', 'SDA', 'SCL'],
  'seven-segment': ['VCC', 'GND', 'CLK', 'DIO'], servo: ['VCC', 'SIG', 'GND'], motor: ['M+', 'M−'], relay: ['VCC', 'IN', 'GND'],
  l298n: ['ENA', 'IN1', 'IN2', 'OUT1', 'OUT2', 'GND'], buzzer: ['+', '−'], battery: ['+', '−'], mosfet: ['G', 'D', 'S'], hv400kv: ['IN · модель', 'HV OUT · модель', 'RETURN · модель'],
  potentiometer: ['A', 'W', 'B'], button: ['1', '2'], 'function-generator': ['SIG', 'GND', 'EN'], 'pulse-generator': ['SIG', 'GND', 'EN'],
  scope: ['CH1', 'GND'], capacitor: ['1', '2'], diode: ['A', 'K'], transistor: ['B', 'C', 'E'], breadboard: ['+ rail', '− rail'],
};
function pinsFor(type) { return pinMap[type] || ['SIG', 'VCC', 'GND']; }
function graphicFor(type) {
  if (type === 'board') return '<svg viewBox="0 0 180 96" aria-hidden="true"><rect x="18" y="8" width="145" height="80" rx="9" fill="#246b4f" stroke="#75a978" stroke-width="2"/><circle cx="29" cy="19" r="4" fill="#16271e" stroke="#acbd95"/><circle cx="151" cy="19" r="4" fill="#16271e" stroke="#acbd95"/><circle cx="29" cy="77" r="4" fill="#16271e" stroke="#acbd95"/><circle cx="151" cy="77" r="4" fill="#16271e" stroke="#acbd95"/><rect x="2" y="36" width="23" height="26" rx="3" fill="#b7bdb4" stroke="#717b75" stroke-width="2"/><rect x="45" y="19" width="26" height="23" rx="3" fill="#171e19" stroke="#64796b"/><rect x="81" y="35" width="47" height="36" rx="3" fill="#151a17" stroke="#87937e"/><path d="M88 40v25m7-25v25m7-25v25m7-25v25m7-25v25" stroke="#6a746b"/><rect x="134" y="27" width="19" height="10" rx="2" fill="#b9bfb2"/><circle cx="76" cy="23" r="3" fill="#f0db63"/><circle cx="76" cy="34" r="3" fill="#79dc71"/><text x="46" y="57" fill="#d7e4ce" font-size="9" font-weight="bold">UNO</text><g fill="#dbc98e"><circle cx="42" cy="8" r="2"/><circle cx="54" cy="8" r="2"/><circle cx="66" cy="8" r="2"/><circle cx="78" cy="8" r="2"/><circle cx="90" cy="8" r="2"/><circle cx="102" cy="8" r="2"/><circle cx="114" cy="8" r="2"/><circle cx="126" cy="8" r="2"/><circle cx="42" cy="88" r="2"/><circle cx="54" cy="88" r="2"/><circle cx="66" cy="88" r="2"/><circle cx="78" cy="88" r="2"/><circle cx="90" cy="88" r="2"/><circle cx="102" cy="88" r="2"/><circle cx="114" cy="88" r="2"/><circle cx="126" cy="88" r="2"/></g></svg>';
  if (type === 'nano') return '<svg viewBox="0 0 180 96" aria-hidden="true"><rect x="48" y="4" width="84" height="88" rx="8" fill="#246b4f" stroke="#75a978" stroke-width="2"/><rect x="75" y="0" width="31" height="12" rx="3" fill="#bec2b8" stroke="#737a72"/><rect x="69" y="32" width="42" height="31" rx="3" fill="#171e19" stroke="#899486"/><text x="78" y="51" fill="#d8e4d3" font-size="9">NANO</text><circle cx="62" cy="25" r="3" fill="#ebd763"/><circle cx="119" cy="25" r="3" fill="#79dc71"/><g fill="#dbc98e"><circle cx="53" cy="13" r="2"/><circle cx="67" cy="13" r="2"/><circle cx="81" cy="13" r="2"/><circle cx="95" cy="13" r="2"/><circle cx="109" cy="13" r="2"/><circle cx="123" cy="13" r="2"/><circle cx="53" cy="83" r="2"/><circle cx="67" cy="83" r="2"/><circle cx="81" cy="83" r="2"/><circle cx="95" cy="83" r="2"/><circle cx="109" cy="83" r="2"/><circle cx="123" cy="83" r="2"/></g></svg>';
  if (type === 'esp32') return '<svg viewBox="0 0 180 96" aria-hidden="true"><rect x="42" y="6" width="96" height="84" rx="8" fill="#275c49" stroke="#85a975" stroke-width="2"/><path d="M67 12h46v12H67z" fill="#c3c8bc" stroke="#70786e"/><rect x="67" y="32" width="48" height="34" rx="4" fill="#b5b9ad" stroke="#758074"/><rect x="80" y="42" width="23" height="16" rx="2" fill="#171e19"/><text x="84" y="53" fill="#d6e5cf" font-size="6">ESP32</text><g fill="#dbc98e"><circle cx="47" cy="20" r="2"/><circle cx="47" cy="34" r="2"/><circle cx="47" cy="48" r="2"/><circle cx="47" cy="62" r="2"/><circle cx="47" cy="76" r="2"/><circle cx="133" cy="20" r="2"/><circle cx="133" cy="34" r="2"/><circle cx="133" cy="48" r="2"/><circle cx="133" cy="62" r="2"/><circle cx="133" cy="76" r="2"/></g><circle cx="57" cy="14" r="3" fill="#79dc71"/></svg>';
  if (type === 'pico') return '<svg viewBox="0 0 180 96" aria-hidden="true"><rect x="52" y="5" width="76" height="86" rx="9" fill="#276749" stroke="#84aa70" stroke-width="2"/><rect x="77" y="0" width="26" height="11" rx="3" fill="#bec2b8"/><rect x="70" y="31" width="40" height="32" rx="4" fill="#1b211b" stroke="#8d9d82"/><text x="77" y="50" fill="#d2e1c9" font-size="8">RP2040</text><g fill="#dbc98e"><circle cx="57" cy="16" r="2"/><circle cx="57" cy="28" r="2"/><circle cx="57" cy="40" r="2"/><circle cx="57" cy="52" r="2"/><circle cx="57" cy="64" r="2"/><circle cx="57" cy="76" r="2"/><circle cx="123" cy="16" r="2"/><circle cx="123" cy="28" r="2"/><circle cx="123" cy="40" r="2"/><circle cx="123" cy="52" r="2"/><circle cx="123" cy="64" r="2"/><circle cx="123" cy="76" r="2"/></g></svg>';
  if (type === 'tp4056') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="24" y="14" width="132" height="58" rx="5" fill="#24513e" stroke="#73a16a" stroke-width="2"/><rect x="4" y="31" width="27" height="24" rx="4" fill="#b4b8ad" stroke="#70776d"/><rect x="67" y="28" width="28" height="28" rx="3" fill="#171b18" stroke="#697768"/><text x="70" y="45" fill="#aebbaa" font-size="7">4056</text><rect x="111" y="25" width="22" height="13" rx="2" fill="#d2b374"/><circle cx="45" cy="29" r="4" fill="#ec685d"/><circle cx="45" cy="56" r="4" fill="#72d66b"/><g fill="#e0c98e"><circle cx="51" cy="12" r="3"/><circle cx="67" cy="12" r="3"/><circle cx="83" cy="12" r="3"/><circle cx="99" cy="12" r="3"/><circle cx="115" cy="12" r="3"/><circle cx="131" cy="12" r="3"/><circle cx="51" cy="74" r="3"/><circle cx="67" cy="74" r="3"/><circle cx="83" cy="74" r="3"/><circle cx="99" cy="74" r="3"/><circle cx="115" cy="74" r="3"/><circle cx="131" cy="74" r="3"/></g></svg>';
  if (type === 'sensor' || type === 'dht22') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="37" y="9" width="106" height="64" rx="6" fill="#286247" stroke="#83ad70" stroke-width="2"/><rect x="58" y="17" width="64" height="53" rx="8" fill="#c9cfc1" stroke="#717a6e" stroke-width="2"/><path d="M66 23v42m10-42v42m10-42v42m10-42v42m10-42v42" stroke="#889083" stroke-width="2"/><circle cx="131" cy="17" r="3" fill="#e6d264"/><g fill="#dcc890"><circle cx="51" cy="8" r="2.5"/><circle cx="77" cy="8" r="2.5"/><circle cx="103" cy="8" r="2.5"/><circle cx="129" cy="8" r="2.5"/><circle cx="51" cy="75" r="2.5"/><circle cx="77" cy="75" r="2.5"/><circle cx="103" cy="75" r="2.5"/><circle cx="129" cy="75" r="2.5"/></g></svg>';
  if (type === 'bmp280') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="40" y="11" width="100" height="62" rx="7" fill="#286c50" stroke="#83a56a" stroke-width="2"/><rect x="66" y="24" width="49" height="39" rx="5" fill="#171d19" stroke="#8b9a80" stroke-width="2"/><circle cx="90" cy="43" r="12" fill="#343d35" stroke="#bdc7ac"/><path d="M90 34v9l6 4" fill="none" stroke="#c0f178" stroke-width="2"/><g fill="#e0c890"><circle cx="53" cy="17" r="2.5"/><circle cx="67" cy="17" r="2.5"/><circle cx="81" cy="17" r="2.5"/><circle cx="95" cy="17" r="2.5"/><circle cx="109" cy="17" r="2.5"/><circle cx="123" cy="17" r="2.5"/><circle cx="53" cy="68" r="2.5"/><circle cx="67" cy="68" r="2.5"/><circle cx="81" cy="68" r="2.5"/><circle cx="95" cy="68" r="2.5"/><circle cx="109" cy="68" r="2.5"/><circle cx="123" cy="68" r="2.5"/></g></svg>';
  if (type === 'lm35') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M67 47v28m23-28v28m23-28v28" stroke="#c8cabb" stroke-width="4"/><path d="M62 25a28 25 0 0 1 56 0v24a28 15 0 0 1-56 0Z" fill="#202823" stroke="#8d9b87" stroke-width="2"/><path d="M73 37h34M73 44h34" stroke="#9fac9a" stroke-width="2"/><circle cx="90" cy="24" r="5" fill="#d1d8c3"/></svg>';
  if (type === 'pir') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="33" y="29" width="114" height="42" rx="7" fill="#245d47" stroke="#7ca370" stroke-width="2"/><path d="M60 35a30 29 0 0 1 60 0v2H60z" fill="#d9ded0" stroke="#90998d" stroke-width="2"/><path d="M65 35q25-24 50 0m-44 0q19-18 38 0" fill="none" stroke="#a6afa1"/><circle cx="52" cy="55" r="3" fill="#ed6b61"/><circle cx="128" cy="55" r="3" fill="#83d975"/><g fill="#ddca90"><circle cx="60" cy="74" r="2.5"/><circle cx="90" cy="74" r="2.5"/><circle cx="120" cy="74" r="2.5"/></g></svg>';
  if (type === 'gas') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="32" y="34" width="116" height="39" rx="6" fill="#285f48" stroke="#7ea370" stroke-width="2"/><path d="M65 38V24a25 25 0 0 1 50 0v14" fill="#b8bcb2" stroke="#778078" stroke-width="2"/><path d="M70 22h40M70 27h40M72 32h36" stroke="#7f8880" stroke-width="2"/><rect x="77" y="13" width="26" height="7" rx="3" fill="#d0d4ca"/><g fill="#ddca90"><circle cx="57" cy="76" r="2.5"/><circle cx="79" cy="76" r="2.5"/><circle cx="101" cy="76" r="2.5"/><circle cx="123" cy="76" r="2.5"/></g><circle cx="127" cy="47" r="3" fill="#e4d45b"/></svg>';
  if (type === 'hall') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M65 49v27m25-27v27m25-27v27" stroke="#d5d2b8" stroke-width="4"/><path d="M60 46c0-19 10-31 30-31s30 12 30 31v7H60z" fill="#202824" stroke="#879487" stroke-width="2"/><path d="M73 38a18 18 0 0 1 34 0" fill="none" stroke="#c0f178" stroke-width="3"/><path d="M90 8v12m-7-7h14" stroke="#e6c56e" stroke-width="2"/></svg>';
  if (type === 'soil') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M68 18h44v14H68z" fill="#222b25" stroke="#899881" stroke-width="2"/><path d="M70 31v40m40-40v40" stroke="#bfcbc0" stroke-width="4"/><rect x="61" y="10" width="58" height="10" rx="3" fill="#28694e" stroke="#7fa571"/><path d="M74 14h32" stroke="#d7c88c" stroke-width="2"/><circle cx="90" cy="25" r="4" fill="#e7ce62"/></svg>';
  if (type === 'microphone') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="36" y="29" width="108" height="45" rx="6" fill="#275c49" stroke="#83a66e" stroke-width="2"/><circle cx="90" cy="31" r="23" fill="#424b45" stroke="#b9c2b6" stroke-width="3"/><circle cx="90" cy="31" r="16" fill="#202724" stroke="#8e9b8f"/><g stroke="#aeb8aa"><path d="M78 20v22m6-25v28m6-29v30m6-27v25m6-22v19"/></g><g fill="#ddc98a"><circle cx="65" cy="76" r="2.5"/><circle cx="90" cy="76" r="2.5"/><circle cx="115" cy="76" r="2.5"/></g></svg>';
  if (type === 'current-sensor') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="34" y="15" width="112" height="61" rx="6" fill="#285d47" stroke="#82a872" stroke-width="2"/><rect x="67" y="26" width="46" height="37" rx="4" fill="#181f1a" stroke="#8a9786"/><text x="76" y="47" fill="#d6dfd2" font-size="8">ACS712</text><rect x="42" y="27" width="16" height="12" rx="2" fill="#c4b27e"/><rect x="42" y="51" width="16" height="12" rx="2" fill="#c4b27e"/><g fill="#ddc98b"><circle cx="75" cy="13" r="2.5"/><circle cx="93" cy="13" r="2.5"/><circle cx="111" cy="13" r="2.5"/><circle cx="75" cy="78" r="2.5"/><circle cx="93" cy="78" r="2.5"/><circle cx="111" cy="78" r="2.5"/></g></svg>';
  if (type === 'breadboard') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="15" y="8" width="150" height="68" rx="6" fill="#d6d4c5" stroke="#f3edda" stroke-width="2"/><path d="M27 18h125M27 66h125" stroke="#df796e" stroke-width="2"/><path d="M27 24h125M27 60h125" stroke="#75a9bc" stroke-width="2"/><path d="M26 42h128" stroke="#a0a498" stroke-width="2"/><path d="M28 29h124m-124 6h124m-124 14h124m-124 6h124" stroke="#b7b7a8" stroke-width="1"/><g fill="#81867a"><circle cx="32" cy="31" r="1.5"/><circle cx="42" cy="31" r="1.5"/><circle cx="52" cy="31" r="1.5"/><circle cx="62" cy="31" r="1.5"/><circle cx="72" cy="31" r="1.5"/><circle cx="82" cy="31" r="1.5"/><circle cx="92" cy="31" r="1.5"/><circle cx="102" cy="31" r="1.5"/><circle cx="112" cy="31" r="1.5"/><circle cx="122" cy="31" r="1.5"/><circle cx="132" cy="31" r="1.5"/><circle cx="142" cy="31" r="1.5"/><circle cx="32" cy="52" r="1.5"/><circle cx="42" cy="52" r="1.5"/><circle cx="52" cy="52" r="1.5"/><circle cx="62" cy="52" r="1.5"/><circle cx="72" cy="52" r="1.5"/><circle cx="82" cy="52" r="1.5"/><circle cx="92" cy="52" r="1.5"/><circle cx="102" cy="52" r="1.5"/><circle cx="112" cy="52" r="1.5"/><circle cx="122" cy="52" r="1.5"/><circle cx="132" cy="52" r="1.5"/><circle cx="142" cy="52" r="1.5"/></g></svg>';
  if (type === 'button') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M68 57v19m44-19v19" stroke="#c2c6b9" stroke-width="5"/><rect x="55" y="22" width="70" height="43" rx="6" fill="#c9c9bd" stroke="#f0eee0" stroke-width="3"/><rect x="66" y="14" width="48" height="42" rx="5" fill="#363c36" stroke="#969d8f" stroke-width="3"/><circle cx="90" cy="27" r="11" fill="#4e594d" stroke="#abb5a5" stroke-width="2"/><path d="M78 12h24" stroke="#d9dcce" stroke-width="3"/></svg>';
  if (type === 'potentiometer') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M68 57v21m22-21v21m22-21v21" stroke="#c9cabb" stroke-width="4"/><circle cx="90" cy="43" r="30" fill="#323a33" stroke="#a9b4a5" stroke-width="3"/><circle cx="90" cy="43" r="21" fill="#555e54" stroke="#828d7c" stroke-width="2"/><path d="M90 43 103 27" stroke="#edf0df" stroke-width="4" stroke-linecap="round"/><circle cx="90" cy="43" r="4" fill="#c0f178"/></svg>';
  if (type === 'buzzer') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M76 63v17m28-17v17" stroke="#c3c7b9" stroke-width="4"/><ellipse cx="90" cy="60" rx="34" ry="9" fill="#101512"/><path d="M56 26a34 34 0 0 1 68 0v34H56z" fill="#252b27" stroke="#79847a" stroke-width="3"/><ellipse cx="90" cy="26" rx="34" ry="13" fill="#373f39" stroke="#a6b0a4" stroke-width="2"/><circle cx="90" cy="25" r="7" fill="#141916" stroke="#89958a" stroke-width="2"/><path d="M86 22h8" stroke="#d3d8ca" stroke-width="2"/></svg>';
  if (type === 'ultrasonic') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="20" y="18" width="140" height="54" rx="8" fill="#235c9b" stroke="#78add7" stroke-width="2"/><circle cx="63" cy="41" r="24" fill="#c2c7c1" stroke="#eef0e7" stroke-width="3"/><circle cx="63" cy="41" r="17" fill="#8f9993" stroke="#626d66" stroke-width="2"/><circle cx="117" cy="41" r="24" fill="#c2c7c1" stroke="#eef0e7" stroke-width="3"/><circle cx="117" cy="41" r="17" fill="#8f9993" stroke="#626d66" stroke-width="2"/><path d="M39 68v10m24-10v10m24-10v10m24-10v10m24-10v10" stroke="#d6c88f" stroke-width="3"/></svg>';
  if (type === 'ldr') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M77 52v28m26-28v28" stroke="#c4c8ba" stroke-width="4"/><circle cx="90" cy="37" r="25" fill="#d8bd65" stroke="#f2df9c" stroke-width="3"/><path d="M70 26c10 8 30 8 40 0M68 34c12 8 32 8 44 0M69 43c12 8 30 8 42 0" fill="none" stroke="#886d34" stroke-width="3"/><path d="m49 22-12-8m13 20H33m16 12-11 8m82-32 12-8m-13 20h16m-16 12 11 8" stroke="#e7ce79" stroke-width="2"/></svg>';
  if (type === 'servo') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="41" y="24" width="98" height="49" rx="7" fill="#3768a3" stroke="#89b5dc" stroke-width="2"/><rect x="54" y="32" width="71" height="33" rx="4" fill="#2d598b" stroke="#6d94bd"/><circle cx="90" cy="28" r="10" fill="#d6d6c8" stroke="#f4f1e2" stroke-width="2"/><path d="M90 18V7m0 21 27-10m-27 10-25-10" stroke="#d9dacd" stroke-width="5" stroke-linecap="round"/><path d="M56 75v7m21-7v7m21-7v7m21-7v7" stroke="#d6c78b" stroke-width="3"/><path d="M139 31c13 0 13 26 0 26" fill="none" stroke="#292f2b" stroke-width="3"/></svg>';
  if (type === 'motor') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="48" y="20" width="77" height="48" rx="18" fill="#9da49c" stroke="#e0e1d8" stroke-width="3"/><path d="M125 42h38" stroke="#c7c9bd" stroke-width="7" stroke-linecap="round"/><path d="M56 26h61M56 34h61M56 42h61M56 50h61M56 58h61" stroke="#7c847c" stroke-width="2"/><rect x="41" y="29" width="10" height="27" rx="3" fill="#4e574f"/><path d="M66 68v11m16-11v11" stroke="#d2c78e" stroke-width="3"/><circle cx="50" cy="18" r="3" fill="#d2c78e"/></svg>';
  if (type === 'relay') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="32" y="9" width="116" height="66" rx="5" fill="#245e9a" stroke="#8bbbe2" stroke-width="2"/><rect x="56" y="19" width="66" height="42" rx="5" fill="#d8d8cc" stroke="#f1efe4" stroke-width="2"/><path d="M68 30h42v20H68z" fill="#c5c6b9" stroke="#858c82"/><path d="M39 20h14v13H39zm95 30h9v15h-9z" fill="#d2b77a"/><g fill="#d4c68b"><circle cx="52" cy="71" r="2.5"/><circle cx="75" cy="71" r="2.5"/><circle cx="98" cy="71" r="2.5"/><circle cx="121" cy="71" r="2.5"/></g><circle cx="137" cy="19" r="3" fill="#e5ce62"/></svg>';
  if (type === 'mosfet') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M75 54v28m15-28v28m15-28v28" stroke="#c7c9bd" stroke-width="4"/><path d="M69 53V31a21 21 0 0 1 42 0v22" fill="#202723" stroke="#858f84" stroke-width="3"/><path d="M69 31h42" stroke="#aeb8aa" stroke-width="3"/><circle cx="90" cy="31" r="5" fill="#434d44"/><path d="M90 9v10" stroke="#c9cabc" stroke-width="4"/></svg>';
  if (type === 'l298n') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="18" y="18" width="144" height="56" rx="6" fill="#225e9c" stroke="#8ebbe0" stroke-width="2"/><rect x="66" y="27" width="49" height="38" rx="3" fill="#242a2b" stroke="#b1b9b5" stroke-width="2"/><path d="M72 31v30m7-30v30m7-30v30m7-30v30m7-30v30m7-30v30" stroke="#9ca7a3"/><rect x="25" y="28" width="25" height="14" rx="2" fill="#d4b779"/><rect x="25" y="50" width="25" height="14" rx="2" fill="#d4b779"/><rect x="126" y="28" width="27" height="14" rx="2" fill="#d4b779"/><rect x="126" y="50" width="27" height="14" rx="2" fill="#d4b779"/><path d="M77 14V5m13 9V5m13 9V5" stroke="#cfc9a4" stroke-width="3"/><circle cx="57" cy="24" r="3" fill="#e5d05d"/></svg>';
  if (type === 'capacitor') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M77 56v25m26-25v25" stroke="#c8c9bc" stroke-width="4"/><path d="M64 27a26 12 0 0 1 52 0v29a26 12 0 0 1-52 0z" fill="#343e39" stroke="#a9b7a7" stroke-width="2"/><ellipse cx="90" cy="27" rx="26" ry="12" fill="#4b5850" stroke="#bdc7bb" stroke-width="2"/><path d="M70 27h40" stroke="#d57b68" stroke-width="4"/><path d="M69 37h42m-42 7h42" stroke="#7e8a7f" stroke-width="2"/><path d="M78 22h24" stroke="#e4e8dc" stroke-width="2"/></svg>';
  if (type === 'diode') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M12 42h53m50 0h53" stroke="#c6c8bc" stroke-width="4"/><rect x="63" y="28" width="54" height="28" rx="13" fill="#252a27" stroke="#aeb5a8" stroke-width="2"/><path d="M99 28v28" stroke="#d7d7ca" stroke-width="5"/><path d="m76 34 15 8-15 8z" fill="#aab4a8"/></svg>';
  if (type === 'transistor') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M76 52v28m14-28v28m14-28v28" stroke="#c9c9bd" stroke-width="4"/><path d="M61 50V34a29 26 0 0 1 58 0v16z" fill="#202723" stroke="#869286" stroke-width="3"/><path d="M73 34h34m-17-20v14" stroke="#b9c3b4" stroke-width="3"/><circle cx="90" cy="34" r="5" fill="#4d594d"/></svg>';
  if (type === 'led') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M77 56v23m26-23v23" stroke="#c2c6b7" stroke-width="4"/><path d="M66 40a22 22 0 1 1 44 0c0 10-6 14-9 20H75c-3-6-9-10-9-20Z" fill="#df766a" stroke="#ffc0a5" stroke-width="3"/><path d="M75 48h26" stroke="#f9c6ad" stroke-width="2"/></svg>';
  if (type === 'rgb-led') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M66 52v27m17-27v27m17-27v27m17-27v27" stroke="#d3d0bf" stroke-width="3"/><path d="M60 37a17 18 0 1 1 34 0c0 7-4 11-7 16H67c-3-5-7-9-7-16Z" fill="#e76552" stroke="#ffc7a0" stroke-width="2"/><path d="M77 27a17 18 0 1 1 34 0c0 7-4 11-7 16H84c-3-5-7-9-7-16Z" fill="#73c96d" stroke="#c6f0aa" stroke-width="2"/><path d="M94 37a17 18 0 1 1 34 0c0 7-4 11-7 16h-20c-3-5-7-9-7-16Z" fill="#649cdc" stroke="#b9d9ff" stroke-width="2"/></svg>';
  if (type === 'resistor') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M12 42h42m72 0h42" stroke="#c4c6b9" stroke-width="4"/><rect x="53" y="26" width="74" height="32" rx="14" fill="#d0b78d" stroke="#efdbb2" stroke-width="2"/><path d="M69 28v28m15-30v32m15-32v32m15-30v28" stroke="#9e6148" stroke-width="5"/></svg>';
  if (type === 'hv400kv') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="35" y="9" width="110" height="66" rx="7" fill="#30221e" stroke="#f0a861" stroke-width="2" stroke-dasharray="5 4"/><path d="m94 20-19 27h16l-5 17 21-30H91l3-14Z" fill="#f4bd62"/><text x="47" y="70" fill="#f5bd75" font-size="8">CONCEPT ONLY</text></svg>';
  if (type === 'function-generator') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="21" y="10" width="138" height="64" rx="7" fill="#3b4446" stroke="#a2b8b5" stroke-width="2"/><rect x="37" y="19" width="89" height="42" rx="3" fill="#10191b" stroke="#7a9391"/><path d="M43 40c7-19 14-19 21 0s14 19 21 0 14-19 21 0 14 19 21 0" fill="none" stroke="#a4ed70" stroke-width="3"/><circle cx="143" cy="29" r="8" fill="#222927" stroke="#d0d4c8" stroke-width="3"/><circle cx="143" cy="53" r="8" fill="#222927" stroke="#d0d4c8" stroke-width="3"/><circle cx="49" cy="70" r="2.5" fill="#dfcb8f"/><circle cx="65" cy="70" r="2.5" fill="#dfcb8f"/></svg>';
  if (type === 'pulse-generator') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="21" y="10" width="138" height="64" rx="7" fill="#354146" stroke="#9bb2b9" stroke-width="2"/><rect x="37" y="19" width="89" height="42" rx="3" fill="#10191b" stroke="#7a9391"/><path d="M43 48h17V29h20v19h18V29h20v19h8" fill="none" stroke="#b9ed72" stroke-width="3"/><circle cx="143" cy="29" r="8" fill="#222927" stroke="#d0d4c8" stroke-width="3"/><circle cx="143" cy="53" r="8" fill="#222927" stroke="#d0d4c8" stroke-width="3"/><circle cx="49" cy="70" r="2.5" fill="#dfcb8f"/><circle cx="65" cy="70" r="2.5" fill="#dfcb8f"/><circle cx="81" cy="70" r="2.5" fill="#dfcb8f"/></svg>';
  if (type === 'scope') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="19" y="7" width="142" height="70" rx="9" fill="#444b49" stroke="#acb8ae" stroke-width="2"/><rect x="34" y="17" width="93" height="45" rx="3" fill="#081314" stroke="#7d928c" stroke-width="2"/><path d="M39 25h83M39 34h83M39 43h83M39 52h83M50 20v39m20-39v39m20-39v39m20-39v39" stroke="#243b37"/><path d="M40 45h15l8-16 12 27 10-16h16l8-10 12 15h4" fill="none" stroke="#8ee676" stroke-width="2.5"/><circle cx="144" cy="27" r="7" fill="#252b28" stroke="#c7cfc1" stroke-width="3"/><circle cx="144" cy="51" r="7" fill="#252b28" stroke="#c7cfc1" stroke-width="3"/></svg>';
  if (type === 'oled') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="31" y="9" width="118" height="67" rx="6" fill="#26664a" stroke="#85a973" stroke-width="2"/><rect x="44" y="16" width="92" height="49" rx="3" fill="#071714" stroke="#789079" stroke-width="2"/><path d="M54 27h29v7H54zm38 0h28v7H92zM54 40h18v7H54zm27 0h39v7H81zM54 53h26v6H54z" fill="#b8ee76"/><circle cx="54" cy="72" r="2" fill="#ddcb8f"/><circle cx="72" cy="72" r="2" fill="#ddcb8f"/><circle cx="90" cy="72" r="2" fill="#ddcb8f"/><circle cx="108" cy="72" r="2" fill="#ddcb8f"/></svg>';
  if (type === 'lcd1602') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="19" y="12" width="142" height="59" rx="6" fill="#275d91" stroke="#9cc5dd" stroke-width="2"/><rect x="36" y="20" width="109" height="37" rx="3" fill="#90a56d" stroke="#d1d6b1" stroke-width="2"/><rect x="45" y="27" width="6" height="9" fill="#263525"/><rect x="55" y="27" width="6" height="9" fill="#263525"/><rect x="69" y="27" width="6" height="9" fill="#263525"/><rect x="79" y="27" width="6" height="9" fill="#263525"/><rect x="89" y="27" width="6" height="9" fill="#263525"/><rect x="99" y="27" width="6" height="9" fill="#263525"/><rect x="45" y="41" width="6" height="9" fill="#263525"/><rect x="55" y="41" width="6" height="9" fill="#263525"/><rect x="69" y="41" width="6" height="9" fill="#263525"/><rect x="79" y="41" width="6" height="9" fill="#263525"/><rect x="89" y="41" width="6" height="9" fill="#263525"/><rect x="99" y="41" width="6" height="9" fill="#263525"/><path d="M48 72v7m17-7v7m17-7v7m17-7v7m17-7v7m17-7v7" stroke="#d9ca8f" stroke-width="2"/></svg>';
  if (type === 'seven-segment') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="25" y="8" width="130" height="68" rx="6" fill="#282f2b" stroke="#849082" stroke-width="2"/><g fill="#e06053"><path d="M46 18h22l-4 5H50zM46 38h22l-4 5H50zM46 58h22l-4 5H50zM45 21h5v17h-5zm21 0h5v17h-5zm-21 22h5v15h-5zm21 0h5v15h-5z"/><path d="M86 18h22l-4 5H90zM86 38h22l-4 5H90zM86 58h22l-4 5H90zM85 21h5v17h-5zm21 0h5v17h-5zm-21 22h5v15h-5zm21 0h5v15h-5z"/></g><circle cx="126" cy="61" r="4" fill="#e06053"/><path d="M53 76v6m13-6v6m22-6v6m13-6v6" stroke="#d0c58c" stroke-width="2"/></svg>';
  if (type === 'battery') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="55" y="12" width="70" height="61" rx="18" fill="#515951" stroke="#c2c8bb" stroke-width="3"/><rect x="77" y="7" width="26" height="8" rx="2" fill="#ded9ba"/><path d="M65 31h50m-50 10h50m-50 10h50" stroke="#7e887c" stroke-width="3"/><path d="M79 26h22" stroke="#d8dfd0" stroke-width="2"/></svg>';
  return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="44" y="12" width="92" height="60" rx="8" fill="#343e37" stroke="#82917b" stroke-width="2"/><circle cx="90" cy="42" r="17" fill="#17201a" stroke="#c0f178" stroke-width="3"/><path d="M90 31v22m-11-11h22" stroke="#c0f178" stroke-width="3"/></svg>';
}
document.querySelectorAll('.component-row').forEach((button) => {
  const preview = button.querySelector('.component-glyph');
  if (!preview) return;
  preview.classList.add('palette-image');
  preview.innerHTML = graphicFor(button.dataset.part);
  preview.setAttribute('aria-hidden', 'true');
});
function renderParts() {
  componentLayer.replaceChildren();
  const rows = Math.ceil((activeProject.parts || []).length / 2);
  canvas.style.height = activeProject.id !== defaultProject.id ? `${Math.max(258, rows * 174 + 28)}px` : '258px';
  if (activeProject.id !== defaultProject.id) {
    activeProject.parts.forEach((part, index) => {
      const item = document.createElement('article');
      item.className = 'placed-part component-card';
      item.dataset.type = part.type;
      item.dataset.componentId = part.id;
      const canvasWidth = Math.max(1, canvas.clientWidth);
      const canvasHeight = Math.max(1, canvas.clientHeight);
      const maxX = Math.max(0, 1 - Math.min(220, canvasWidth * 0.48) / canvasWidth);
      part.x = Number.isFinite(part.x) ? Math.min(part.x, maxX) : (index % 2 ? Math.min(0.51, maxX) : 0.02);
      part.y = Number.isFinite(part.y) ? Math.min(part.y, Math.max(0, 1 - 172 / canvasHeight)) : (Math.floor(index / 2) * 174 + 12) / canvasHeight;
      item.style.left = `${part.x * 100}%`;
      item.style.top = `${part.y * 100}%`;
      const pinButtons = pinsFor(part.type).slice(0, 8).map((pin) => `<button class="visual-pin" type="button" data-pin-name="${escapeHtml(pin)}" title="Контакт ${escapeHtml(pin)}"><i></i><span>${escapeHtml(pin)}</span></button>`).join('');
      item.innerHTML = `<div class="component-card-head"><span class="drag-handle" title="Перетащи, чтобы переместить" aria-label="Переместить элемент">⠿</span><span class="component-led"></span><span class="placed-part-name"></span><button class="remove-part" type="button" aria-label="Убрать компонент" title="Убрать компонент">×</button></div><div class="component-graphic">${graphicFor(part.type)}</div><div class="visual-pins">${pinButtons || '<span class="concept-pad">Нет физических контактов</span>'}</div>`;
      item.querySelector('.placed-part-name').textContent = part.name;
      item.querySelector('.remove-part').addEventListener('click', () => {
        activeProject.parts.splice(index, 1);
        activeProject.connections = activeProject.connections.filter((wire) => wire.from.partId !== part.id && wire.to.partId !== part.id);
        renderParts();
        saveActiveProject();
        renderProjects();
      });
      componentLayer.append(item);
      attachDragHandle(item, part);
    });
  }
  const count = activeProject.id === defaultProject.id ? 3 : activeProject.parts.length;
  const connectionCount = activeProject.id === defaultProject.id ? 2 : (activeProject.connections || []).length;
  const boardName = activeProject.board || 'Схема без платы';
  document.querySelector('.canvas-footer span:nth-child(2)').innerHTML = `${escapeHtml(boardName)} <b>·</b> ${count} компонентов <b>·</b> ${connectionCount} проводов`;
  document.querySelector('.workspace-badge').innerHTML = `<i></i> ${activeProject.id === defaultProject.id ? 'Черновик сохранён' : 'Автосохранение включено'}`;
  document.querySelectorAll('.component-row').forEach((row) => row.classList.remove('added'));
  componentLayer.style.transform = `scale(${zoom / 100})`;
  renderConnectionPanel();
  requestAnimationFrame(drawConnections);
}

function attachDragHandle(card, part) {
  const handle = card.querySelector('.drag-handle');
  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const scale = zoom / 100;
    const cardRect = card.getBoundingClientRect();
    const grabX = (event.clientX - cardRect.left) / scale;
    const grabY = (event.clientY - cardRect.top) / scale;
    handle.setPointerCapture(event.pointerId);
    card.classList.add('dragging');
    const move = (moveEvent) => {
      const rect = canvas.getBoundingClientRect();
      const left = (moveEvent.clientX - rect.left + canvas.scrollLeft) / scale - grabX;
      const top = (moveEvent.clientY - rect.top + canvas.scrollTop) / scale - grabY;
      const maxLeft = Math.max(0, canvas.clientWidth - card.offsetWidth);
      const maxTop = Math.max(0, canvas.clientHeight - card.offsetHeight);
      const clampedLeft = Math.max(0, Math.min(left, maxLeft));
      const clampedTop = Math.max(0, Math.min(top, maxTop));
      part.x = clampedLeft / Math.max(1, canvas.clientWidth);
      part.y = clampedTop / Math.max(1, canvas.clientHeight);
      card.style.left = `${part.x * 100}%`;
      card.style.top = `${part.y * 100}%`;
      requestAnimationFrame(drawConnections);
    };
    const finish = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      card.classList.remove('dragging');
      saveActiveProject();
      renderProjects();
      drawConnections();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  });
}

function fillComponentOptions(select, preferredValue) {
  const eligible = activeProject.parts.filter((part) => pinsFor(part.type).length > 0);
  select.replaceChildren();
  if (!eligible.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Добавь компонент';
    select.append(option);
    select.disabled = true;
    return '';
  }
  for (const part of eligible) {
    const option = document.createElement('option');
    option.value = part.id;
    option.textContent = part.name;
    select.append(option);
  }
  select.disabled = false;
  const value = eligible.some((part) => part.id === preferredValue) ? preferredValue : eligible[0].id;
  select.value = value;
  return value;
}
function fillPinOptions(componentId, pinSelect, preferredPin) {
  const part = activeProject.parts.find((item) => item.id === componentId);
  const pins = part ? pinsFor(part.type) : [];
  pinSelect.replaceChildren();
  for (const pin of pins) {
    const option = document.createElement('option');
    option.value = pin;
    option.textContent = pin;
    pinSelect.append(option);
  }
  pinSelect.disabled = pins.length === 0;
  if (pins.includes(preferredPin)) pinSelect.value = preferredPin;
  return pins[0] || '';
}
function renderConnectionPanel() {
  const fromSelect = document.querySelector('#wire-from');
  const toSelect = document.querySelector('#wire-to');
  const fromPin = document.querySelector('#pin-from');
  const toPin = document.querySelector('#pin-to');
  const oldFrom = fromSelect.value;
  const oldTo = toSelect.value;
  const fromId = fillComponentOptions(fromSelect, oldFrom);
  const nextPart = activeProject.parts.find((part) => part.id !== fromId && pinsFor(part.type).length > 0);
  const toId = fillComponentOptions(toSelect, oldTo || nextPart?.id || fromId);
  fillPinOptions(fromId, fromPin, fromPin.value);
  fillPinOptions(toId, toPin, toPin.value);
  document.querySelector('#connect-wire').disabled = !fromId || !toId;
  const partsById = new Map(activeProject.parts.map((part) => [part.id, part]));
  const list = document.querySelector('#connection-list');
  list.replaceChildren();
  const connections = activeProject.id === defaultProject.id ? [] : (activeProject.connections || []);
  document.querySelector('#connection-count').textContent = String(connections.length);
  document.querySelector('#connection-help').textContent = activeProject.parts.length
    ? 'Выбери начало и конец провода здесь или нажми на контакты на поле.'
    : 'Сначала добавь компоненты слева. Контакты блока 400 кВ условные; линии на поле не описывают реальное подключение.';
  connections.forEach((wire, index) => {
    const from = partsById.get(wire.from.partId);
    const to = partsById.get(wire.to.partId);
    if (!from || !to) return;
    const row = document.createElement('div');
    row.className = 'connection-item';
    const description = document.createElement('span');
    description.textContent = `${from.name} · ${wire.from.pin} → ${to.name} · ${wire.to.pin}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-wire';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Удалить провод');
    remove.addEventListener('click', () => {
      activeProject.connections.splice(index, 1);
      saveActiveProject();
      renderParts();
    });
    row.append(description, remove);
    list.append(row);
  });
}
function drawConnections() {
  const svg = document.querySelector('#connections-svg');
  const bounds = canvas.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  svg.replaceChildren();
  if (activeProject.id === defaultProject.id) return;
  const ns = 'http://www.w3.org/2000/svg';
  for (const wire of activeProject.connections || []) {
    const findPin = (endpoint) => {
      const card = Array.from(componentLayer.querySelectorAll('.component-card')).find((item) => item.dataset.componentId === endpoint.partId);
      return card && Array.from(card.querySelectorAll('.visual-pin')).find((pin) => pin.dataset.pinName === endpoint.pin);
    };
    const from = findPin(wire.from);
    const to = findPin(wire.to);
    if (!from || !to) continue;
    const point = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2 - bounds.left, y: rect.top + rect.height / 2 - bounds.top };
    };
    const a = point(from);
    const b = point(to);
    const midX = (a.x + b.x) / 2;
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`);
    path.setAttribute('stroke', wire.color || '#dc6b56');
    path.setAttribute('class', 'drawn-wire');
    svg.append(path);
    for (const p of [a, b]) {
      const endpoint = document.createElementNS(ns, 'circle');
      endpoint.setAttribute('cx', p.x);
      endpoint.setAttribute('cy', p.y);
      endpoint.setAttribute('r', 4);
      endpoint.setAttribute('fill', wire.color || '#dc6b56');
      endpoint.setAttribute('class', 'wire-endpoint');
      svg.append(endpoint);
    }
  }
}
function createWire() {
  const fromId = document.querySelector('#wire-from').value;
  const fromPin = document.querySelector('#pin-from').value;
  const toId = document.querySelector('#wire-to').value;
  const toPin = document.querySelector('#pin-to').value;
  if (!fromId || !fromPin || !toId || !toPin) { showToast('Выбери оба компонента и контакта'); return; }
  if (fromId === toId && fromPin === toPin) { showToast('Выбери два разных контакта'); return; }
  activeProject.connections ||= [];
  activeProject.connections.push({ from: { partId: fromId, pin: fromPin }, to: { partId: toId, pin: toPin }, color: document.querySelector('#wire-color').value });
  saveActiveProject();
  renderParts();
  showToast('Провод добавлен на схему');
}
document.querySelector('#wire-from').addEventListener('change', (event) => fillPinOptions(event.target.value, document.querySelector('#pin-from')));
document.querySelector('#wire-to').addEventListener('change', (event) => fillPinOptions(event.target.value, document.querySelector('#pin-to')));
document.querySelector('#connect-wire').addEventListener('click', createWire);
let padPickStep = 0;
componentLayer.addEventListener('click', (event) => {
  const pin = event.target.closest('.visual-pin');
  if (!pin || activeProject.id === defaultProject.id) return;
  const card = pin.closest('.component-card');
  if (padPickStep === 0) {
    document.querySelector('#wire-from').value = card.dataset.componentId;
    fillPinOptions(card.dataset.componentId, document.querySelector('#pin-from'), pin.dataset.pinName);
    padPickStep = 1;
    showToast(`Начало провода: ${pin.dataset.pinName}. Теперь выбери второй контакт.`);
  } else {
    document.querySelector('#wire-to').value = card.dataset.componentId;
    fillPinOptions(card.dataset.componentId, document.querySelector('#pin-to'), pin.dataset.pinName);
    padPickStep = 0;
    createWire();
  }
});
window.addEventListener('resize', () => requestAnimationFrame(drawConnections));

function openProjectDialog() {
  projectForm.reset();
  projectModal.hidden = false;
  requestAnimationFrame(() => document.querySelector('#project-name').focus());
}
function closeProjectDialog() { projectModal.hidden = true; }
document.querySelector('#new-project').addEventListener('click', openProjectDialog);
document.querySelector('#close-project-modal').addEventListener('click', closeProjectDialog);
document.querySelector('#cancel-project').addEventListener('click', closeProjectDialog);
projectModal.addEventListener('click', (event) => { if (event.target === projectModal) closeProjectDialog(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !projectModal.hidden) closeProjectDialog(); });
projectForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(projectForm);
  const name = String(form.get('name') || '').trim();
  if (!name) { document.querySelector('#project-name').focus(); return; }
  const project = {
    id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description: String(form.get('description') || '').trim(),
    parts: [],
    connections: [],
    code: defaultCode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projects.unshift(project);
  persistProjects();
  closeProjectDialog();
  activateProject(project.id);
  showToast(`Проект «${name}» создан и сохранён`);
});

function deleteProject(id) {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  if (!confirm(`Удалить проект «${project.name}» из этого браузера?`)) return;
  projects = projects.filter((item) => item.id !== id);
  persistProjects();
  if (activeProject.id === id) activateProject(defaultProject.id);
  renderProjects();
  showToast('Проект удалён');
}

document.querySelectorAll('.component-row').forEach((button) => button.addEventListener('click', () => {
  if (activeProject.id === defaultProject.id) {
    const project = { ...defaultProject, id: `project-${Date.now()}`, name: 'Мой проект', description: 'Создан из редактора схем', board: null, parts: [], connections: [], code: codeEditor.value, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    projects.unshift(project);
    activeProject = project;
    localStorage.setItem('circuitlab-active-project', project.id);
    canvas.classList.add('user-project');
    document.querySelector('#active-project-name').textContent = project.name;
    showToast('Создал проект «Мой проект» — теперь добавляй детали');
  }
  const title = button.querySelector('span:nth-child(2)');
  const part = { id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: button.dataset.part, name: button.dataset.name || title.childNodes[0].textContent.trim(), icon: button.dataset.icon || button.querySelector('.component-glyph').textContent.trim() };
  activeProject.parts.push(part);
  button.classList.add('added');
  renderParts();
  saveActiveProject();
  renderProjects();
  showToast(button.dataset.safety === 'high-voltage'
    ? 'Добавлен генератор импульсов 400 кВ с условными клеммами для визуальных проводов.'
    : `${part.name} добавлен в проект`);
}));

const categoryByPart = {
  board: 'boards', nano: 'boards', esp32: 'boards', pico: 'boards',
  led: 'passive', 'rgb-led': 'passive', resistor: 'passive', button: 'passive', potentiometer: 'passive', mosfet: 'passive', capacitor: 'passive', diode: 'passive', transistor: 'passive', breadboard: 'passive',
  sensor: 'sensors', dht22: 'sensors', ultrasonic: 'sensors', ldr: 'sensors', bmp280: 'sensors', lm35: 'sensors', pir: 'sensors', gas: 'sensors', hall: 'sensors', soil: 'sensors', microphone: 'sensors', 'current-sensor': 'sensors',
  'function-generator': 'signals', 'pulse-generator': 'signals', hv400kv: 'signals', scope: 'signals',
  battery: 'power', tp4056: 'power',
  oled: 'displays', lcd1602: 'displays', 'seven-segment': 'displays',
  servo: 'drivers', motor: 'drivers', relay: 'drivers', l298n: 'drivers', buzzer: 'drivers',
};
document.querySelectorAll('.component-row').forEach((button) => {
  button.dataset.category ||= categoryByPart[button.dataset.part] || 'passive';
});
function filterComponents() {
  const query = document.querySelector('#component-search').value.trim().toLocaleLowerCase('ru');
  const category = document.querySelector('#component-category').value;
  document.querySelectorAll('.component-row').forEach((button) => {
    const matchesText = button.textContent.toLocaleLowerCase('ru').includes(query);
    const matchesCategory = category === 'all' || button.dataset.category === category;
    button.hidden = !matchesText || !matchesCategory;
  });
}
document.querySelector('#component-search').addEventListener('input', filterComponents);
document.querySelector('#component-category').addEventListener('change', filterComponents);
document.querySelector('#add-component').addEventListener('click', () => {
  document.querySelector('#components').scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Выбери деталь из списка слева');
});

let zoom = 100;
function applyZoom() {
  document.querySelector('#zoom-level').textContent = `${zoom}%`;
  canvas.style.backgroundSize = `${18 * zoom / 100}px ${18 * zoom / 100}px`;
  componentLayer.style.transform = `scale(${zoom / 100})`;
}
document.querySelector('#zoom-in').addEventListener('click', () => { zoom = Math.min(140, zoom + 10); applyZoom(); });
document.querySelector('#zoom-out').addEventListener('click', () => { zoom = Math.max(70, zoom - 10); applyZoom(); });
document.querySelector('#zoom-reset').addEventListener('click', () => { zoom = 100; applyZoom(); });

let isRunning = false;
let blinkTimer;
document.querySelector('#simulate').addEventListener('click', (event) => {
  if (activeProject.id !== defaultProject.id && !activeProject.parts.some((part) => part.type === 'led' || part.type === 'rgb-led')) {
    showToast('Добавь светодиод, чтобы показать демо');
    return;
  }
  isRunning = !isRunning;
  const button = event.currentTarget;
  button.classList.toggle('running', isRunning);
  button.innerHTML = isRunning ? '<span>Ⅱ</span> Стоп' : '<span>▷</span> Симуляция';
  const led = activeProject.id === defaultProject.id
    ? document.querySelector('.led-dome')
    : document.querySelector('.placed-part[data-type="led"] .placed-part-icon, .placed-part[data-type="rgb-led"] .placed-part-icon');
  if (!led) { isRunning = false; button.classList.remove('running'); button.innerHTML = '<span>▷</span> Симуляция'; return; }
  if (isRunning) {
    showToast('Демо: светодиод мигает по скетчу');
    led.style.boxShadow = '0 0 16px #ff796b';
    blinkTimer = setInterval(() => { led.classList.toggle('lit'); led.style.boxShadow = led.classList.contains('lit') ? '0 0 16px #ff796b' : 'none'; }, 1000);
  } else {
    clearInterval(blinkTimer);
    led.classList.remove('lit');
    led.style.boxShadow = '0 0 8px #ea765044';
    showToast('Демонстрация остановлена');
  }
});

document.querySelector('#copy-code').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(codeEditor.value);
    showToast('Скетч скопирован в буфер обмена');
  } catch { showToast('Разреши доступ к буферу обмена в браузере'); }
});
codeEditor.addEventListener('input', () => {
  activeProject.code = codeEditor.value;
  saveActiveProject();
});

document.querySelector('.mobile-menu').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('mobile-open'));
document.querySelectorAll('.more-button:not(.project-menu)').forEach((button) => button.addEventListener('click', () => showToast('Это пример проекта')));

const savedActiveId = localStorage.getItem('circuitlab-active-project');
const savedActive = projects.find((project) => project.id === savedActiveId);
activateProject(savedActive ? savedActive.id : defaultProject.id);
