const toast = document.querySelector('#toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

const canvas = document.querySelector('#canvas-grid');
let zoom = 100;
function applyZoom() {
  document.querySelector('#zoom-level').textContent = `${zoom}%`;
  canvas.style.backgroundSize = `${18 * zoom / 100}px ${18 * zoom / 100}px`;
  canvas.style.transform = `scale(${zoom / 100})`;
}
document.querySelector('#zoom-in').addEventListener('click', () => { zoom = Math.min(140, zoom + 10); applyZoom(); });
document.querySelector('#zoom-out').addEventListener('click', () => { zoom = Math.max(70, zoom - 10); applyZoom(); });
document.querySelector('#zoom-reset').addEventListener('click', () => { zoom = 100; applyZoom(); });

const partNames = { led: 'Светодиод добавлен на поле', resistor: 'Резистор добавлен на поле', board: 'Arduino Uno добавлена на поле', sensor: 'Датчик DHT11 добавлен на поле', breadboard: 'Макетная плата добавлена на поле' };
document.querySelectorAll('.component-row').forEach((button) => button.addEventListener('click', () => {
  const part = button.dataset.part;
  const count = Number(localStorage.getItem('circuitlab-components') || 3) + 1;
  localStorage.setItem('circuitlab-components', count);
  document.querySelector('.canvas-footer span:nth-child(2)').innerHTML = `Arduino Uno <b>·</b> ${count} компонента <b>·</b> 2 соединения`;
  showToast(partNames[part]);
}));
document.querySelector('#add-component').addEventListener('click', () => showToast('Выбери компонент из списка слева'));

let isRunning = false;
let blinkTimer;
document.querySelector('#simulate').addEventListener('click', (event) => {
  isRunning = !isRunning;
  const button = event.currentTarget;
  button.classList.toggle('running', isRunning);
  button.innerHTML = isRunning ? '<span>Ⅱ</span> Стоп' : '<span>▷</span> Симуляция';
  const led = document.querySelector('.led-dome');
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
  const code = `// мигаем светодиодом на пине 13\nconst int ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  delay(1000);\n  digitalWrite(ledPin, LOW);\n  delay(1000);\n}`;
  try {
    await navigator.clipboard.writeText(code);
    showToast('Скетч скопирован в буфер обмена');
  } catch {
    showToast('Разреши доступ к буферу обмена в браузере');
  }
});

document.querySelector('#new-project').addEventListener('click', () => {
  const name = prompt('Как назовём новый проект?');
  if (name && name.trim()) {
    const projects = JSON.parse(localStorage.getItem('circuitlab-projects') || '[]');
    projects.push({ name: name.trim(), createdAt: new Date().toISOString() });
    localStorage.setItem('circuitlab-projects', JSON.stringify(projects));
    showToast(`«${name.trim()}» сохранён в этом браузере`);
  }
});

document.querySelector('.mobile-menu').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('mobile-open');
});
document.querySelectorAll('.more-button').forEach((button) => button.addEventListener('click', () => showToast('Действия проекта появятся здесь')));
