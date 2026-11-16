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
  if (['board', 'nano', 'esp32', 'pico'].includes(type)) return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="18" y="8" width="144" height="68" rx="6" fill="#286846" stroke="#6b9b6a" stroke-width="2"/><rect x="2" y="31" width="20" height="22" rx="3" fill="#bcc2b4" stroke="#768172"/><rect x="70" y="25" width="41" height="34" rx="3" fill="#171d19" stroke="#68796a"/><path d="M33 17h24m74 0h18M34 67h26m58 0h28" stroke="#b9d3aa" stroke-width="2"/><circle cx="44" cy="38" r="4" fill="#e3d76d"/><text x="79" y="45" fill="#b9cbb5" font-size="8">MCU</text><g fill="#d9c78e"><circle cx="42" cy="7" r="2"/><circle cx="54" cy="7" r="2"/><circle cx="66" cy="7" r="2"/><circle cx="78" cy="7" r="2"/><circle cx="90" cy="7" r="2"/><circle cx="102" cy="7" r="2"/><circle cx="114" cy="7" r="2"/><circle cx="126" cy="7" r="2"/><circle cx="42" cy="77" r="2"/><circle cx="54" cy="77" r="2"/><circle cx="66" cy="77" r="2"/><circle cx="78" cy="77" r="2"/><circle cx="90" cy="77" r="2"/><circle cx="102" cy="77" r="2"/><circle cx="114" cy="77" r="2"/><circle cx="126" cy="77" r="2"/></g></svg>';
  if (type === 'tp4056') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="24" y="14" width="132" height="58" rx="5" fill="#24513e" stroke="#73a16a" stroke-width="2"/><rect x="4" y="31" width="27" height="24" rx="4" fill="#b4b8ad" stroke="#70776d"/><rect x="67" y="28" width="28" height="28" rx="3" fill="#171b18" stroke="#697768"/><text x="70" y="45" fill="#aebbaa" font-size="7">4056</text><rect x="111" y="25" width="22" height="13" rx="2" fill="#d2b374"/><circle cx="45" cy="29" r="4" fill="#ec685d"/><circle cx="45" cy="56" r="4" fill="#72d66b"/><g fill="#e0c98e"><circle cx="51" cy="12" r="3"/><circle cx="67" cy="12" r="3"/><circle cx="83" cy="12" r="3"/><circle cx="99" cy="12" r="3"/><circle cx="115" cy="12" r="3"/><circle cx="131" cy="12" r="3"/><circle cx="51" cy="74" r="3"/><circle cx="67" cy="74" r="3"/><circle cx="83" cy="74" r="3"/><circle cx="99" cy="74" r="3"/><circle cx="115" cy="74" r="3"/><circle cx="131" cy="74" r="3"/></g></svg>';
  if (['sensor', 'dht22', 'bmp280', 'lm35', 'pir', 'gas', 'hall', 'soil', 'microphone', 'current-sensor'].includes(type)) return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="33" y="9" width="114" height="63" rx="6" fill="#285e49" stroke="#78a06b" stroke-width="2"/><rect x="61" y="23" width="58" height="38" rx="4" fill="#c9cfbb" stroke="#75806e"/><path d="M69 28v28m8-28v28m8-28v28m8-28v28m8-28v28" stroke="#909988"/><circle cx="127" cy="20" r="3" fill="#eac95e"/><g fill="#dcc890"><circle cx="55" cy="6" r="2.5"/><circle cx="75" cy="6" r="2.5"/><circle cx="95" cy="6" r="2.5"/><circle cx="115" cy="6" r="2.5"/><circle cx="55" cy="75" r="2.5"/><circle cx="75" cy="75" r="2.5"/><circle cx="95" cy="75" r="2.5"/><circle cx="115" cy="75" r="2.5"/></g></svg>';
  if (type === 'led' || type === 'rgb-led') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M77 56v23m26-23v23" stroke="#c2c6b7" stroke-width="4"/><path d="M66 40a22 22 0 1 1 44 0c0 10-6 14-9 20H75c-3-6-9-10-9-20Z" fill="#df766a" stroke="#ffc0a5" stroke-width="3"/><path d="M75 48h26" stroke="#f9c6ad" stroke-width="2"/></svg>';
  if (type === 'resistor') return '<svg viewBox="0 0 180 84" aria-hidden="true"><path d="M12 42h42m72 0h42" stroke="#c4c6b9" stroke-width="4"/><rect x="53" y="26" width="74" height="32" rx="14" fill="#d0b78d" stroke="#efdbb2" stroke-width="2"/><path d="M69 28v28m15-30v32m15-32v32m15-30v28" stroke="#9e6148" stroke-width="5"/></svg>';
  if (type === 'hv400kv') return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="35" y="9" width="110" height="66" rx="7" fill="#30221e" stroke="#f0a861" stroke-width="2" stroke-dasharray="5 4"/><path d="m94 20-19 27h16l-5 17 21-30H91l3-14Z" fill="#f4bd62"/><text x="47" y="70" fill="#f5bd75" font-size="8">CONCEPT ONLY</text></svg>';
  if (['function-generator', 'pulse-generator', 'scope'].includes(type)) return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="24" y="9" width="132" height="66" rx="6" fill="#29343a" stroke="#83a9b1" stroke-width="2"/><rect x="43" y="20" width="95" height="40" rx="3" fill="#101a1c" stroke="#557279"/><path d="M51 42h14l8-13 12 26 10-13h15m0 0h20" fill="none" stroke="#b9ed72" stroke-width="3"/><circle cx="54" cy="68" r="3" fill="#d5c987"/><circle cx="68" cy="68" r="3" fill="#d5c987"/></svg>';
  if (['oled', 'lcd1602', 'seven-segment'].includes(type)) return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="25" y="9" width="130" height="66" rx="6" fill="#2e644b" stroke="#7ca86e" stroke-width="2"/><rect x="41" y="18" width="98" height="45" rx="3" fill="#131e1d" stroke="#97ad87" stroke-width="2"/><path d="M50 31h24m-24 10h48m-48 10h36" stroke="#bcf073" stroke-width="3"/></svg>';
  if (['battery', 'tp4056'].includes(type)) return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="51" y="12" width="78" height="60" rx="9" fill="#525c51" stroke="#b9c2b2" stroke-width="2"/><rect x="72" y="7" width="36" height="7" rx="2" fill="#d2cda9"/><path d="M67 31h46m-46 12h46m-46 12h46" stroke="#91a087" stroke-width="3"/></svg>';
  return '<svg viewBox="0 0 180 84" aria-hidden="true"><rect x="44" y="12" width="92" height="60" rx="8" fill="#343e37" stroke="#82917b" stroke-width="2"/><circle cx="90" cy="42" r="17" fill="#17201a" stroke="#c0f178" stroke-width="3"/><path d="M90 31v22m-11-11h22" stroke="#c0f178" stroke-width="3"/></svg>';
}
function renderParts() {
  componentLayer.replaceChildren();
  if (activeProject.id !== defaultProject.id) {
    activeProject.parts.forEach((part, index) => {
      const item = document.createElement('article');
      item.className = 'placed-part component-card';
      item.dataset.type = part.type;
      item.dataset.componentId = part.id;
      const pinButtons = pinsFor(part.type).slice(0, 8).map((pin) => `<button class="visual-pin" type="button" data-pin-name="${escapeHtml(pin)}" title="Контакт ${escapeHtml(pin)}"><i></i><span>${escapeHtml(pin)}</span></button>`).join('');
      item.innerHTML = `<div class="component-card-head"><span class="component-led"></span><span class="placed-part-name"></span><button class="remove-part" type="button" aria-label="Убрать компонент" title="Убрать компонент">×</button></div><div class="component-graphic">${graphicFor(part.type)}</div><div class="visual-pins">${pinButtons || '<span class="concept-pad">Нет физических контактов</span>'}</div>`;
      item.querySelector('.placed-part-name').textContent = part.name;
      item.querySelector('.remove-part').addEventListener('click', () => {
        activeProject.parts.splice(index, 1);
        activeProject.connections = activeProject.connections.filter((wire) => wire.from.partId !== part.id && wire.to.partId !== part.id);
        renderParts();
        saveActiveProject();
        renderProjects();
      });
      componentLayer.append(item);
    });
  }
  const count = activeProject.id === defaultProject.id ? 3 : activeProject.parts.length;
  const connectionCount = activeProject.id === defaultProject.id ? 2 : (activeProject.connections || []).length;
  const boardName = activeProject.board || 'Схема без платы';
  document.querySelector('.canvas-footer span:nth-child(2)').innerHTML = `${escapeHtml(boardName)} <b>·</b> ${count} компонентов <b>·</b> ${connectionCount} проводов`;
  document.querySelector('.workspace-badge').innerHTML = `<i></i> ${activeProject.id === defaultProject.id ? 'Черновик сохранён' : 'Автосохранение включено'}`;
  document.querySelectorAll('.component-row').forEach((row) => row.classList.remove('added'));
  componentLayer.style.transform = `scale(${zoom / 100})`;
  const rows = Math.ceil((activeProject.parts || []).length / 2);
  if (activeProject.id !== defaultProject.id) canvas.style.height = `${Math.max(258, rows * 174 + 28)}px`;
  else canvas.style.height = '258px';
  renderConnectionPanel();
  requestAnimationFrame(drawConnections);
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
