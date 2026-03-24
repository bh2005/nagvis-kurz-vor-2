let currentStep = 0;

function startTour() {
  currentStep = 0;
  showStep(currentStep);
}

function showStep(index) {
  const step = quickStartSteps[index];
  const target = document.querySelector(step.element);
  if (!target) return;

  // Highlight-Effekt: Wir fügen eine temporäre Klasse hinzu
  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
  target.classList.add('tour-highlight');
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Tooltip am Element anzeigen
  showTourTooltip(target, step.title, step.text, index);
}

function showTourTooltip(target, title, text, index) {
  const rect = target.getBoundingClientRect();
  let tooltip = document.getElementById('tour-tooltip') || createTooltipElement();
  
  tooltip.style.display = 'block';
  tooltip.style.top = `${rect.bottom + 10 + window.scrollY}px`;
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  
  tooltip.innerHTML = `
    <h4>${title}</h4>
    <p>${text}</p>
    <div class="tour-btns">
      ${index > 0 ? `<button onclick="showStep(${index-1})">Zurück</button>` : ''}
      <button class="btn-ok" onclick="${index < quickStartSteps.length - 1 ? `showStep(${index+1})` : 'endTour()'}">
        ${index < quickStartSteps.length - 1 ? 'Weiter' : 'Fertig!'}
      </button>
    </div>
  `;
}