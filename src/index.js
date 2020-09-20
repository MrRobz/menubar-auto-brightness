const noUiSlider = require('nouislider');
const psList = require('ps-list');
const { ipcRenderer, remote } = require('electron')

const macAppRegex = RegExp('Applications\/.*?.app\/Contents\/MacOS', 'i');

const handleChangeBrightness = (values, handle) => {
  ipcRenderer.send('globalBrightnessUpdate', values[handle]);
};

const handleProcessChangeBrightness = (pid, brightness) => {
  ipcRenderer.send('updateProcessBrightness', pid, brightness);
}

async function openProcessSelector() {
  await createProcessDropdownList();
  document.getElementById("processDropdown").classList.toggle("show");
  document.querySelector("#processDropdown input").focus();
}

async function filterProcess() {
  let input = document.querySelector("#processDropdown input");
  let value = input.value.toLowerCase();

  let processList = await psList({ all: false });
  let filteredProcess = processList.filter(process => {
    return macAppRegex.test(process.cmd)
      && process.ppid === 1
      && process.cmd.toLowerCase().includes(value);
  });

  renderProcessOptions(filteredProcess);
}

async function createProcessDropdownList() {
  let processList = await psList({ all: false });
  processList = processList.filter((process) => {
    return macAppRegex.test(process.cmd) && process.ppid === 1
  });
  renderProcessOptions(processList);
}

function renderProcessOptions(list) {
  let dropdownList = document.querySelector(".dropdown-item-list");
  
  let processListDom = list.map(p => {
    let name = (p.cmd.toLocaleLowerCase().match(/applications\/(.*)\.app\//) || [])[1];
    if (name) {
      return (`
        <div class="dropdown-item" data-pid=${p.pid}>
          ${name}
        </div>
      `)
    } else {
      return '';
    }
  }).join(' ');

  dropdownList.innerHTML = processListDom;
}

document.querySelector('.dropdown-item-list').addEventListener('click', async function(event) {
  let target = event.target;
  if (target.classList.contains('dropdown-item')) {
    let pid = target.getAttribute('data-pid');

    let processList = await psList({ all: false });
    let selectedProcess = processList.find(p => p.pid === parseInt(pid));
    
    document.getElementById("processDropdown").classList.remove("show");

    createaProcessSlider(selectedProcess);
    ipcRenderer.send('processSelectedByUser', selectedProcess);
  }
});

document.querySelector('body').addEventListener('click', (event) => {
  let target = event.target;
  if (!document.querySelector(".process-selector-wrapper").contains(target)) {
    document.getElementById("processDropdown").classList.remove("show");
  }
});

function createaProcessSlider(process) {
  if (document.getElementById(process.pid)) {
    return;
  }

  let tempDiv = document.createElement('div');
  tempDiv.setAttribute('class', 'watch-item');
  tempDiv.setAttribute('id', process.pid);

  let processName = (process.cmd.match(/Applications\/(.*)\.app\//)|| [])[1] || process.name;

  tempDiv.innerHTML = `
  <div class="watch-label">
    <label>${processName}:</label>
    <button class="btn watch-close" onclick="removeWatchOnProcess(${process.pid})">
      X
    </button>
  </div>
  <div class="range"></div>
  `;

 document.querySelector(".watching-processes-list").appendChild(tempDiv);

  let rangeDom = tempDiv.querySelector(".range");
  noUiSlider.create(rangeDom, {
    start: 80,
    connect: [true, false],
    range: {
      min: 0,
      max: 100,
    },
  });

  rangeDom.noUiSlider.on('update', (args) => handleProcessChangeBrightness(process.pid, ...args));
}

function removeWatchOnProcess(pid) {
  let processDom = document.getElementById(pid);
  processDom.parentElement.removeChild(processDom);

  ipcRenderer.send('removeWatchOnProcess', pid);
}

function pauseResumeServices() {
  let pauseDom = document.getElementById("pauseResumeServices");
  let isPaused = pauseDom.getAttribute("is-paused");

  if (!isPaused) {
    pauseDom.setAttribute("is-paused", true);
    pauseDom.textContent = "Resume service";
    ipcRenderer.send('pauseService', true);
  } else {
    pauseDom.removeAttribute("is-paused");
    pauseDom.textContent = "Pause service";
    ipcRenderer.send('pauseService', false);
  }
}

async function init() {
  const el = document.getElementById('range');

  noUiSlider.create(el, {
    start: 70,
    connect: [true, false],
    range: {
      min: 0.05,
      max: 100,
    },
  });

  el.noUiSlider.on('update', handleChangeBrightness);

  ipcRenderer.send('requestInitialValue');
  ipcRenderer.on('setInitialValue', (event, value) => el.noUiSlider.set(value));
}

init()


