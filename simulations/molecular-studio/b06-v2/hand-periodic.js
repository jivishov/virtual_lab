import {bySymbol, families, periodicTable} from './periodic-elements.js';
import {ELEMENTS} from './molecule-model.js';
import {ionFor, ionLabel} from './ionic-model.js';
import {floatControl,panelBounds} from './floating-control.js';
import {createPeriodicVoice} from './periodic-voice.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const directions = {ArrowLeft:[0,-1], ArrowRight:[0,1], ArrowUp:[-1,0], ArrowDown:[1,0]};

export function createHandPeriodicTable(main, placeElements, resetHands) {
  const orb = document.createElement('button');
  orb.id = 'hand-periodic-orb';
  orb.type = 'button';
  orb.setAttribute('aria-label', 'Open periodic table');
  orb.title = 'Hold an open palm over the sphere, click, or grasp and release to open. Drag to move. Arrow keys move the sphere. Home restores its starting position.';
  orb.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
  orb.setAttribute('aria-haspopup', 'dialog');
  orb.setAttribute('aria-controls', 'hand-periodic-panel');
  orb.setAttribute('aria-expanded', 'false');
  orb.innerHTML = '<span class="pt-pearl" aria-hidden="true"><i></i></span>';

  const panel = document.createElement('dialog');
  panel.id = 'hand-periodic-panel';
  panel.setAttribute('aria-labelledby', 'hand-periodic-title');
  panel.setAttribute('aria-describedby', 'hand-periodic-hint');
  panel.innerHTML = `
    <div class="pt-sheet">
      <header class="pt-head"><div><h2 id="hand-periodic-title">Periodic table</h2>
        <p id="hand-periodic-hint"></p></div>
        <div class="pt-modes" role="group" aria-label="Build with">
          <button type="button" data-chemistry="molecular">Molecules</button>
          <button type="button" data-chemistry="ionic">Ionic compounds</button>
        </div>
        <button class="pt-close" type="button" autofocus><strong>Close table</strong><span class="pt-selection-count">No atoms selected</span></button></header>
      <div class="pt-legend" aria-label="Element families"></div>
      <div class="pt-scroll"><div class="pt-grid" role="group" aria-label="Elements in periodic table order"></div></div>
      <footer class="pt-foot"><span class="pt-readout" role="status"></span>
        <div class="pt-scroll-tools" aria-label="Scroll periodic table">
          <button type="button" data-scroll="left" aria-label="Scroll table left">←</button>
          <button type="button" data-scroll="right" aria-label="Scroll table right">→</button>
          <button type="button" data-scroll="up" aria-label="Scroll table up">↑</button>
          <button type="button" data-scroll="down" aria-label="Scroll table down">↓</button>
        </div>
        <span class="pt-mass-note">[ ] = isotope mass number</span></footer>
    </div>`;
  const sheet = panel.querySelector('.pt-sheet');
  const closeButton = panel.querySelector('.pt-close');
  const grid = panel.querySelector('.pt-grid');
  const scroller = panel.querySelector('.pt-scroll');
  const readout = panel.querySelector('.pt-readout');
  const scrollKeys = [...panel.querySelectorAll('[data-scroll]')];
  const modeKeys = [...panel.querySelectorAll('[data-chemistry]')];
  const cells = new Map();
  const selected = new Set();
  const feedback = main.querySelector('.hand-bar [role=status]');
  let surface = null, flight = null, closing = false, pending = false, revision = 0, mountedMode = null;
  const builder=()=>main.dataset.mode==='builder';
  const available=()=>builder() && !!surface && main.classList.contains('hands-on');
  const greeting = new Audio(new URL('./periodic-welcome.mp3?v=20261113-voice-close',import.meta.url).href);
  greeting.preload = 'auto';
  const voice = createPeriodicVoice(main,open,()=>{selected.clear();close();});
  let greetingActive = false;
  function stopWelcome() {
    greetingActive=false;
    greeting.pause();
    greeting.currentTime=0;
  }
  function welcome() {
    if(!available())return;
    stopWelcome();
    voice.pause();
    orb.classList.add('pt-welcoming');
    greetingActive=true;
    greeting.play().catch(error => {
      if (error.name==='AbortError') return;
      if (greetingActive && available()) {
        if (feedback) feedback.textContent='Hi! Hold your palm here or say "open periodic table" and to see the periodic table.';
        finishWelcome();
      }
    });
  }
  function finishWelcome() {
    if (!greetingActive) return;
    stopWelcome();
    if (available() && !panel.open) voice.resume();
  }
  greeting.addEventListener('ended',finishWelcome);
  // On a narrow screen the bench is one tall column (model, kit, hand bar, view bar, task panel):
  // the sphere stays on the model there, clear of the kit and the controls under it.
  const narrow = matchMedia('(max-width:900px)');
  // The B06 hand layout fills the edges with the kit, the task tiles and the hand bar, so the sphere
  // stays on the model there too, in its lower left corner: clear of the title (upper left) and of the
  // molecule, which the view keeps in the middle.
  const handLayout = () => main.classList.contains('ms-hand-layout') && !main.classList.contains('immersive');
  const area = () => {
    const stage = (handLayout() || narrow.matches && !main.classList.contains('immersive')) && main.querySelector('#builder-stage');
    return (stage || surface).getBoundingClientRect();
  };
  const floatingOrb = floatControl(orb,orb,{
    bounds: () => surface && panelBounds(area(),orb),
    home(b) {
      if (handLayout()) return {x:b.left, y:b.bottom};
      const r=area();
      const home={x:r.left+.06*r.width-b.width/2, y:r.top+.36*r.height-b.height/2};
      const rail=main.querySelector('.immerse-hud')?.getBoundingClientRect();
      // Keep the sphere exposed beside the narrower left toolbar.
      if (rail?.height && home.x<rail.right+12 && home.x+b.width>rail.left-12
          && home.y<rail.bottom+12 && home.y+b.height>rail.top-12) home.x=rail.right+12;
      return home;
    }
  });
  let lastSymbol = 'H', chemistry = 'molecular';

  for (const [family, name] of Object.entries(families)) {
    const key = document.createElement('span');
    key.dataset.family = family;
    key.textContent = name;
    panel.querySelector('.pt-legend').append(key);
  }
  function marker(text, row, column, className, end) {
    const label = document.createElement('span');
    label.className = className;
    label.textContent = text;
    label.style.gridRow = row;
    label.style.gridColumn = end ? column+' / '+end : column;
    grid.append(label);
  }
  for (let group=1; group<=18; group++) marker(group,1,group+1,'pt-axis');
  for (let period=1; period<=7; period++) marker(period,period+1,1,'pt-axis');
  marker('57–71',7,4,'pt-range');
  marker('89–103',8,4,'pt-range');
  marker('57–71',10,1,'pt-series',4);
  marker('89–103',11,1,'pt-series',4);

  for (const el of periodicTable) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'pt-cell';
    cell.dataset.symbol = el.symbol;
    cell.dataset.family = el.family;
    cell.tabIndex = el.symbol === lastSymbol ? 0 : -1;
    cell.style.gridColumn = el.column+1;
    cell.style.gridRow = el.row+(el.row>7 ? 2 : 1);
    cell.innerHTML = '<span class="pt-number">'+el.number+'</span><strong>'+el.symbol+'</strong><span class="pt-name">'+el.name+'</span><span class="pt-weight">'+el.weight+'</span>';
    cell.querySelector('.pt-name').style.setProperty('--pt-letters',el.name.length);
    if (el.available) {
      cell.setAttribute('role','checkbox');
      cell.insertAdjacentHTML('beforeend','<span class="pt-check" aria-hidden="true"></span>');
    }
    cells.set(el.symbol,cell);
    grid.append(cell);
  }
  function rememberCell(cell) {
    cells.get(lastSymbol).tabIndex = -1;
    lastSymbol = cell.dataset.symbol;
    cell.tabIndex = 0;
  }
  function selectChemistry(next) {
    chemistry = next;
    const ionic = next === 'ionic';
    const onIonicBench = main.dataset.mode === 'builder' && main.dataset.chemistry === 'ionic';
    for (const key of modeKeys) key.setAttribute('aria-pressed',String(key.dataset.chemistry===next));
    for (const el of periodicTable) {
      const cell = cells.get(el.symbol);
      const ion = ionic && ionFor(el.symbol);
      const placeable = el.available && (!ionic || Boolean(ion));
      cell.disabled = !placeable;
      cell.dataset.placeable = String(placeable);
      cell.querySelector('strong').textContent = el.symbol;
      if(!placeable)selected.delete(el.symbol);
      if(el.available)cell.setAttribute('aria-checked',String(selected.has(el.symbol)));
      const action = placeable ? el.name : el.name+' (reference only)';
      let detail = '';
      if (ion) {
        const count = Math.abs(ion.charge);
        detail = 'Can '+(ion.charge>0?'give ':'receive ')+count+' electron'+(count===1?'':'s')+' to form '+ionLabel(el.symbol);
        if (el.symbol==='C') detail += '. Use with Be or Mg for a single-carbon carbide.';
      } else if (!ionic && ELEMENTS[el.symbol]?.looseOnly) {
        detail = 'Choose Ionic compounds to transfer electrons to a nonmetal.';
      }
      const mass = el.weight.startsWith('[') ? 'Isotope mass number '+el.weight.slice(1,-1) : 'Atomic weight '+el.weight;
      cell.title = [action, families[el.family], detail].filter(Boolean).join(' · ');
      cell.setAttribute('aria-label',[action,el.symbol,'Atomic number '+el.number,mass,families[el.family],detail].filter(Boolean).join('. '));
    }
    if (cells.get(lastSymbol).disabled) rememberCell(cells.get('H'));
    const usesCurrent = main.dataset.mode==='builder' && !onIonicBench;
    const destination=ionic?'the electron-transfer bench':usesCurrent?'this bench':'Free construction';
    panel.querySelector('#hand-periodic-hint').textContent =
      'Click or grasp a cell to check or uncheck it. Click or grasp Close table to place one atom of each checked element on '+destination+'.';
    updateCloseButton();
    readout.textContent = ionic && onIonicBench
      ? [main.querySelector('#molecule-formula')?.textContent, main.querySelector('#model-count')?.textContent].filter(Boolean).join(' · ')
      : ionic ? 'Try one Mg atom and two Cl atoms.' : 'Available for placement · Group 1 and 2 metals and reactive nonmetals';
  }
  function updateCloseButton() {
    const action=selected.size ? 'Place '+selected.size+' atom'+(selected.size===1?'':'s') : 'No atoms selected';
    closeButton.querySelector('.pt-selection-count').textContent=action;
    closeButton.setAttribute('aria-label',selected.size ? action+' and close table' : 'Close periodic table');
  }
  for (const key of modeKeys) key.onclick = () => {
    if (pending || closing || key.dataset.chemistry===chemistry) return;
    selectChemistry(key.dataset.chemistry);
  };
  function inspect(el) {
    const position = el.group ? 'Group '+el.group+' · Period '+el.period : 'Period '+el.period;
    const ion = chemistry==='ionic' && ionFor(el.symbol);
    let use = cells.get(el.symbol).disabled ? 'Reference only' : 'Available for selection';
    if (ion) use = 'Neutral '+el.symbol+' · Forms '+ionLabel(el.symbol)+' after transfer'+(el.symbol==='C'?' · Use Be or Mg':'');
    else if (ELEMENTS[el.symbol]?.looseOnly) use = 'Neutral atom · Use Ionic compounds to transfer electrons';
    readout.textContent = el.name+' · '+position+' · '+families[el.family]+' · '+use;
  }
  grid.addEventListener('focusin', e => {
    const cell = e.target.closest('[data-symbol]');
    if (cell) { rememberCell(cell); inspect(bySymbol.get(cell.dataset.symbol)); }
  });
  grid.addEventListener('pointerover', e => {
    const cell=e.target.closest('[data-symbol]');
    if(cell && !cell.contains(e.relatedTarget))inspect(bySymbol.get(cell.dataset.symbol));
  });
  // Hand aiming marks the same controls as pointer hover without moving the pointer.
  new MutationObserver(changes => {
    const aimed = changes.find(({target})=>target.classList.contains('hand-aim'));
    if (aimed) inspect(bySymbol.get(aimed.target.dataset.symbol));
  }).observe(grid,{subtree:true,attributes:true,attributeFilter:['class']});
  grid.addEventListener('keydown', e => {
    const cell = e.target.closest('[data-symbol]');
    if (!cell || !directions[e.key]) return;
    e.preventDefault();
    const [dr,dc] = directions[e.key];
    const el = bySymbol.get(cell.dataset.symbol);
    const candidates = periodicTable.filter(p => !cells.get(p.symbol).disabled).filter(p => dr
      ? p.column===el.column && (p.row-el.row)*dr>0
      : p.row===el.row && (p.column-el.column)*dc>0);
    candidates.sort((a,b) => dr ? (a.row-b.row)*dr : (a.column-b.column)*dc);
    if (candidates.length) cells.get(candidates[0].symbol).focus();
  });

  function updateScrolling() {
    const xRemaining = scroller.scrollWidth-scroller.clientWidth;
    const yRemaining = scroller.scrollHeight-scroller.clientHeight;
    for (const button of scrollKeys) {
      const dir = button.dataset.scroll;
      const horizontal = dir==='left' || dir==='right';
      const position = horizontal ? scroller.scrollLeft : scroller.scrollTop;
      const remaining = horizontal ? xRemaining : yRemaining;
      button.hidden = remaining<=2;
      button.disabled = dir==='left' || dir==='up' ? position<=1 : position>=remaining-1;
    }
  }
  scroller.addEventListener('scroll',updateScrolling,{passive:true});
  for (const button of scrollKeys) button.onclick = () => {
    const dir = button.dataset.scroll;
    const dx = dir==='left' ? -1 : dir==='right' ? 1 : 0;
    const dy = dir==='up' ? -1 : dir==='down' ? 1 : 0;
    scroller.scrollBy({left:dx*scroller.clientWidth*.72,top:dy*scroller.clientHeight*.7,behavior:reducedMotion.matches?'instant':'smooth'});
  };

  function positionPanel() {
    if (!surface || !panel.open) return;
    const r = surface.getBoundingClientRect();
    const gap = r.width<600 ? 5 : 10;
    // Use the room beside an open desktop inspector for the reference sheet.
    // The camera and model return to their original size when the sheet closes.
    const bounds = main.getBoundingClientRect();
    panel.style.left = Math.max(0,bounds.left)+gap+'px';
    panel.style.top = Math.max(0,r.top)+gap+'px';
    panel.style.width = Math.min(1460,Math.max(1,Math.min(innerWidth,bounds.right)-Math.max(0,bounds.left)-2*gap))+'px';
    panel.style.setProperty('--pt-height',Math.max(1,Math.min(innerHeight,bounds.bottom)-Math.max(0,r.top)-2*gap)+'px');
    updateScrolling();
  }
  const resize = new ResizeObserver(() => {floatingOrb.layout();positionPanel();});
  new ResizeObserver(updateScrolling).observe(scroller);
  window.addEventListener('resize',positionPanel);
  function motion(opening) {
    flight?.cancel();
    if (reducedMotion.matches || !sheet.animate) return null;
    const start = orb.getBoundingClientRect(), end = panel.getBoundingClientRect();
    const diameter = orb.querySelector('.pt-pearl').getBoundingClientRect().width;
    const dx = start.left+start.width/2-end.left, dy = start.top+start.height/2-end.top;
    const small = {transform:'translate('+dx+'px,'+dy+'px) scale('+(diameter/end.width)+','+(diameter/end.height)+')',opacity:.05,borderRadius:'50%'};
    const large = {transform:'none',opacity:1,borderRadius:'16px'};
    flight = sheet.animate(opening?[small,large]:[large,small],{duration:opening?265:205,easing:opening?'cubic-bezier(.18,.8,.23,1)':'cubic-bezier(.55,.06,.72,.42)',fill:'both'});
    return flight;
  }
  function finishClose(restoreFocus) {
    flight?.cancel(); flight=null;
    if (panel.open) panel.close();
    panel.removeAttribute('aria-busy');
    closing=false; pending=false;
    orb.setAttribute('aria-expanded','false');
    if (restoreFocus && available()) {
      orb.focus({preventScroll:true});
      voice.resume();
    }
  }
  function close(restoreFocus=true, immediate=false) {
    if (!panel.open || (closing && !immediate)) return;
    revision++; closing=true; pending=false;
    resetHands();
    if (immediate) { finishClose(restoreFocus); return; }
    const animation = motion(false);
    if (!animation) { finishClose(restoreFocus); return; }
    animation.onfinish = () => finishClose(restoreFocus);
  }
  function open() {
    if (!available() || panel.open) return;
    stopWelcome();
    orb.classList.remove('pt-welcoming');
    resetHands();
    selected.clear();
    selectChemistry(main.dataset.mode==='builder' && main.dataset.chemistry==='ionic' ? 'ionic' : 'molecular');
    orb.setAttribute('aria-expanded','true');
    panel.showModal();
    voice.resume();
    positionPanel();
    scroller.scrollTo({top:0,left:0,behavior:'instant'});
    closeButton.focus({preventScroll:true});
    const animation = motion(true);
    if (animation) animation.onfinish = () => { animation.cancel(); if(flight===animation)flight=null; };
  }
  orb.onclick = open;
  async function placeAndClose() {
    if (!available() || !panel.open || pending || closing) return;
    if (!selected.size) {close();return;}
    const token = ++revision;
    const current = () => token===revision && available() && panel.open && !closing;
    pending=true;
    panel.setAttribute('aria-busy','true');
    try {
      const message = await placeElements([...selected],current,chemistry);
      if (!current()) return;
      close();
      if (feedback && message) feedback.textContent=message;
    } catch (error) {
      if (current()) readout.textContent=error.message || 'The selected atoms could not be placed.';
    } finally {
      if (current()) {pending=false;panel.removeAttribute('aria-busy');}
    }
  }
  closeButton.onclick = placeAndClose;
  panel.addEventListener('cancel', e => {e.preventDefault();placeAndClose();});
  panel.addEventListener('click', e => {if(e.target===panel)placeAndClose();});
  // Consume application shortcuts while the table has keyboard focus, while
  // retaining native Tab, Space, Enter and cell arrow navigation.
  panel.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key==='Escape') {e.preventDefault();placeAndClose();}
  });
  grid.addEventListener('click',e => {
    const cell = e.target.closest('[data-symbol]');
    if (!available() || !cell || closing || pending || !panel.open) return;
    const el = bySymbol.get(cell.dataset.symbol);
    if (cell.disabled) return;
    rememberCell(cell);
    if (selected.has(el.symbol)) selected.delete(el.symbol);else selected.add(el.symbol);
    cell.setAttribute('aria-checked',String(selected.has(el.symbol)));
    updateCloseButton();
    inspect(el);
  });
  // View commands remain in VSEPR; periodic-table controls never do.
  function syncScope(force=false) {
    const next=builder()?'builder':'guided';
    if(!force && mountedMode===next)return;
    mountedMode=next;
    revision++;stopWelcome();voice.pause();close(false,true);
    selected.clear();orb.classList.remove('pt-welcoming');
    resize.disconnect();floatingOrb.clear();orb.remove();panel.remove();
    orb.hidden=true;orb.disabled=true;panel.inert=true;
    if(!surface || !main.classList.contains('hands-on'))return;
    if(!builder()) {voice.resume();return;}
    orb.hidden=false;orb.disabled=false;panel.inert=false;
    surface.append(orb);main.append(panel);resize.observe(surface);
    const rail=main.querySelector('.immerse-hud');if(rail)resize.observe(rail);
    // The hand layout sizes the model after the session starts; follow it so the sphere keeps its corner.
    const stage=main.querySelector('#builder-stage');if(stage)resize.observe(stage);
    floatingOrb.layout();welcome();
  }
  document.addEventListener('b06-mode',()=>syncScope());
  return {
    mount(bench) {surface=bench;syncScope(true);},
    hide() {
      surface=null;mountedMode=null;revision++;
      stopWelcome();orb.classList.remove('pt-welcoming');voice.pause();
      close(false,true);selected.clear();resize.disconnect();floatingOrb.clear();
      orb.remove();panel.remove();orb.hidden=true;orb.disabled=true;panel.inert=true;
    },
  };
}
