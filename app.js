const toast = document.querySelector('#toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

const defaultCode = `// мигаем светодиодом на пине 13\nconst int ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  delay(1000);\n  digitalWrite(ledPin, LOW);\n  delay(1000);\n}`;
const defaultProject = { id: 'workspace-default', name: 'Новая схема', board: 'Arduino Uno', parts: [], code: localStorage.getItem('circuitlab-default-code') || defaultCode };
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
    return Array.isArray(value) ? value.filter((p) => p && p.id && p.name).map((p) => ({ ...p, parts: Array.isArray(p.parts) ? p.parts : [], code: typeof p.code === 'string' ? p.code : defaultCode })) : [];
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
    card.innerHTML = `<div class="project-art"><span class="created-art-symbol">⌘</span><span class="art-caption">${escapeHtml(project.board || 'DIY PROJECT')}</span></div><div class="project-info"><div class="project-title-row"><h3></h3><button class="more-button project-menu" type="button" aria-label="Удалить проект" title="Удалить проект">···</button></div><p></p><div class="project-meta"><span class="project-status in-progress"><i></i>Мой проект</span><span></span></div><div class="project-tags"><span></span><span>${project.parts.length} компонентов</span></div></div>`;
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

function renderParts() {
  componentLayer.replaceChildren();
  if (activeProject.id !== defaultProject.id) {
    activeProject.parts.forEach((part, index) => {
      const item = document.createElement('div');
      item.className = 'placed-part';
      item.dataset.type = part.type;
      item.innerHTML = `<span class="placed-part-icon"></span><span class="placed-part-name"></span><button class="remove-part" type="button" aria-label="Убрать компонент">×</button>`;
      item.querySelector('.placed-part-icon').textContent = part.icon || '◈';
      item.querySelector('.placed-part-name').textContent = part.name;
      item.querySelector('.remove-part').addEventListener('click', () => {
        activeProject.parts.splice(index, 1);
        renderParts();
        saveActiveProject();
        renderProjects();
      });
      componentLayer.append(item);
    });
  }
  const count = activeProject.id === defaultProject.id ? 3 : activeProject.parts.length;
  const connectionCount = activeProject.id === defaultProject.id ? 2 : Math.max(0, activeProject.parts.length - 1);
  const boardName = activeProject.board || 'Arduino Uno';
  document.querySelector('.canvas-footer span:nth-child(2)').innerHTML = `${escapeHtml(boardName)} <b>·</b> ${count} компонентов <b>·</b> ${connectionCount} соединений`;
  document.querySelector('.workspace-badge').innerHTML = `<i></i> ${activeProject.id === defaultProject.id ? 'Черновик сохранён' : 'Автосохранение включено'}`;
  document.querySelectorAll('.component-row').forEach((row) => row.classList.remove('added'));
}

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
  const board = String(form.get('board') || 'Arduino Uno');
  const project = {
    id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description: String(form.get('description') || '').trim(),
    board,
    parts: [{ type: board.toLowerCase().replaceAll(' ', '-'), name: board, icon: '▦' }],
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
    const project = { ...defaultProject, id: `project-${Date.now()}`, name: 'Мой проект', description: 'Создан из редактора схем', parts: [], code: codeEditor.value, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    projects.unshift(project);
    activeProject = project;
    canvas.classList.add('user-project');
    document.querySelector('#active-project-name').textContent = project.name;
    showToast('Создал проект «Мой проект» — теперь добавляй детали');
  }
  const title = button.querySelector('span:nth-child(2)');
  const part = { type: button.dataset.part, name: button.dataset.name || title.childNodes[0].textContent.trim(), icon: button.dataset.icon || button.querySelector('.component-glyph').textContent.trim() };
  activeProject.parts.push(part);
  button.classList.add('added');
  renderParts();
  saveActiveProject();
  renderProjects();
  showToast(button.dataset.safety === 'high-voltage'
    ? 'Добавлен условный блок 400 кВ. Это символ для концептуальной схемы, не реальная схема устройства.'
    : `${part.name} добавлен в проект`);
}));

const categoryByPart = {
  board: 'boards', nano: 'boards', esp32: 'boards', pico: 'boards',
  led: 'passive', 'rgb-led': 'passive', resistor: 'passive', button: 'passive', potentiometer: 'passive', battery: 'passive', mosfet: 'passive', capacitor: 'passive', diode: 'passive', transistor: 'passive', breadboard: 'passive',
  sensor: 'sensors', dht22: 'sensors', ultrasonic: 'sensors', ldr: 'sensors', bmp280: 'sensors', lm35: 'sensors', pir: 'sensors', gas: 'sensors', hall: 'sensors', soil: 'sensors', microphone: 'sensors', 'current-sensor': 'sensors',
  'function-generator': 'signals', 'pulse-generator': 'signals', hv400kv: 'signals', scope: 'signals',
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
