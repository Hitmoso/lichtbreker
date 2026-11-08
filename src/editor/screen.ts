import './screen.css';
import { trace } from '../core/beam';
import type { Puzzle } from '../core/types';
import { validatePuzzle } from '../core/validate';
import { createGithub, type Github } from '../publish/github';
import type { Session } from '../publish/session';
import { BoardView } from '../render/board';
import { h } from '../ui/dom';
import { fitCell } from '../ui/layout';
import { openSheet } from '../ui/sheet';
import type { Analysis } from '../worker/client';
import { createAnalyser } from './analysis';
import { loadDraft, saveDraft, type Origin } from './draft';
import { History } from './history';
import { COLOR_NAMES, crystalSvg, DIR_NAMES, filterSvg, ICON, mirrorSvg, sourceSvg, TOOL_NAMES, toolSvg } from './icons';
import { humanError, qualityTips } from './messages';
import { openMenu } from './menu';
import { openPublish, originLabel } from './publish';
import { shareLevel } from './share';
import { enterTest } from './testplay';
import { applyTool, CRYSTAL_CYCLE, DEFAULT_VARIANTS, emptyPuzzle, FILTER_CYCLE, TOOLS, type Tool, type Variants } from './tools';

/** Wat de onderdelen van de bouwer (menu, test, publiceren) van het scherm gebruiken. */
export interface EditorApi {
  readonly root: HTMLElement;
  readonly board: BoardView;
  readonly session: Session;
  readonly github: Github;
  readonly puzzle: Puzzle;
  readonly origin: Origin;
  /** Gewijzigd sinds het laatst laden of publiceren? */
  readonly dirty: boolean;
  /** Laatste analyse van de huidige puzzel (null: ongeldig of nog bezig). */
  readonly analysis: Analysis | null;
  /** Gemeld als er een nieuwe analyse is; geeft een afmeldfunctie terug. */
  onAnalysis(cb: () => void): () => void;
  /** Nieuwe puzzel als basis: geschiedenis leeg, niet gewijzigd. */
  load(p: Puzzle, origin: Origin): void;
  /** Wijziging als één ongedaan-stap (bijv. rastermaat). */
  edit(p: Puzzle): void;
  /** Herkomst bijwerken; `clean` = huidige stand geldt als opgeslagen. */
  setOrigin(o: Origin, clean?: boolean): void;
  announce(msg: string): void;
  /** Statuschip in de kop (publicatie), of null. */
  setChip(el: HTMLElement | null): void;
  /** Plek voor de testdok; testmodus aan/uit. */
  readonly testSlot: HTMLElement;
  setTesting(on: boolean): void;
  /** Bord weer aan de bouwer koppelen (na testen). */
  bindBoard(): void;
  fit(): void;
}

const VARIANT_TOOLS = new Set<Tool>(['crystal', 'filter', 'mirror', 'source']);
const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export async function startEditor(root: HTMLElement, session: Session): Promise<EditorApi> {
  const draft = loadDraft();
  let puzzle: Puzzle = draft?.puzzle ?? emptyPuzzle(7, 9, 3);
  let origin: Origin = draft?.origin ?? { kind: 'new' };
  let tool: Tool = draft?.tool ?? 'wall';
  let variants: Variants = { ...DEFAULT_VARIANTS, ...draft?.variants };
  let clean = JSON.stringify(puzzle);
  const history = new History<Puzzle>(puzzle);
  let analysis: Analysis | null = null;
  let analysedFor: Puzzle | null = null;
  let analysing = false;
  const analysisListeners = new Set<() => void>();
  let showingSolution = false;
  let testing = false;
  const github = createGithub(session.token);

  // ---------- opbouw ----------
  root.classList.add('is-editor');
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const announce = (msg: string) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); };

  const backBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Terug naar het spel', html: ICON.back, onClick: () => { if (testing) testExit?.(); else location.href = location.pathname; } });
  const title = h('h1', { class: 'ed-title' }, 'Bouwer');
  const originChip = h('span', { class: 'chip ed-origin' });
  const chipSlot = h('span', { class: 'ed-chip-slot' });
  const publishBtn = h('button', { class: 'btn btn-fire ed-publish', type: 'button', onClick: () => void openPublish(api) }, 'Publiceer');
  const header = h('header', { class: 'top ed-top' }, backBtn, title, originChip, chipSlot, h('span', { class: 'top-spacer' }), publishBtn);

  const host = h('div', { class: 'board-host' });
  const stage = h('main', { class: 'stage ed-stage' }, host);

  const statusLine = h('button', { class: 'ed-status', type: 'button', 'aria-label': 'Controle', onClick: () => openPanelSheet() });
  const variantsRow = h('div', { class: 'ed-variants', role: 'radiogroup' });
  const toolButtons = TOOLS.map((t, i) => h('button', {
    class: 'tool', type: 'button', role: 'radio', 'aria-label': TOOL_NAMES[t], title: `${TOOL_NAMES[t]} (${i + 1})`, 'data-tool': t,
    onClick: () => selectTool(t),
  }));
  const toolsRow = h('div', { class: 'ed-tools', role: 'radiogroup', 'aria-label': 'Gereedschap' }, ...toolButtons);
  const undoBtn = h('button', { class: 'icon-btn ed-icon', type: 'button', 'aria-label': 'Ongedaan maken', title: 'Ongedaan maken (Ctrl+Z)', html: ICON.undo, onClick: () => undo() });
  const redoBtn = h('button', { class: 'icon-btn ed-icon', type: 'button', 'aria-label': 'Opnieuw', title: 'Opnieuw (Ctrl+Shift+Z)', html: ICON.redo, onClick: () => redo() });
  const testBtn = h('button', { class: 'btn btn-ghost ed-act', type: 'button', 'aria-label': 'Test', onClick: () => startTest() },
    h('span', { class: 'ed-act-icon', html: ICON.play }), 'Test');
  const shareBtn = h('button', { class: 'btn btn-ghost ed-act', type: 'button', 'aria-label': 'Deel', onClick: () => void shareLevel(api) },
    h('span', { class: 'ed-act-icon', html: ICON.share }), 'Deel');
  const moreBtn = h('button', { class: 'btn btn-ghost ed-act ed-more', type: 'button', 'aria-label': 'Meer', html: ICON.more, onClick: () => openMenu(api) });
  const actions = h('div', { class: 'ed-actions' }, undoBtn, redoBtn, h('span', { class: 'ed-actions-gap' }), testBtn, shareBtn, moreBtn);
  const left = h('div', { class: 'ed-left' }, variantsRow, toolsRow);
  const panel = h('aside', { class: 'ed-panel', 'aria-label': 'Controle' });
  const testSlot = h('div', { class: 'ed-test-slot' });

  root.replaceChildren(header, stage, statusLine, left, actions, panel, testSlot, live);

  const board = await BoardView.create(host);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  board.setReducedMotion(motion.matches);
  motion.addEventListener?.('change', () => board.setReducedMotion(motion.matches));

  const fit = () => {
    const p = board.currentPuzzle ?? puzzle;
    board.resize(fitCell(stage.clientWidth, stage.clientHeight - 8, p.width, p.height));
  };

  // ---------- analyse ----------
  const analyser = createAnalyser((a, p) => {
    if (p !== puzzle) return;
    analysis = a;
    analysedFor = p;
    analysing = false;
    renderInfo();
    for (const l of analysisListeners) l();
  });

  // ---------- tekenen ----------
  const errorsOf = (p: Puzzle) => validatePuzzle(p);

  /** Tekent de puzzel en werkt alles bij. `changed` = vakken die opploppen. */
  function show(changed?: number[]) {
    board.setPuzzle(puzzle, { changed });
    hideSolution(false);
    if (errorsOf(puzzle).length === 0) board.update([], trace(puzzle, []), { animate: false });
    else board.hideBeam();
    if (analysedFor !== puzzle) {
      analysis = null;
      analysing = errorsOf(puzzle).length === 0;
      analyser.request(puzzle);
    }
    saveDraft({ puzzle, origin, tool, variants });
    renderInfo();
    renderHistory();
    fit();
  }

  const diff = (a: Puzzle, b: Puzzle): number[] => {
    if (a.width !== b.width || a.height !== b.height) return [];
    const out: number[] = [];
    b.cells.forEach((c, i) => { if (JSON.stringify(c) !== JSON.stringify(a.cells[i]) && c.kind !== 'empty') out.push(i); });
    return out;
  };

  let strokeStarted = false;
  function apply(x: number, y: number, first: boolean) {
    const r = applyTool(puzzle, x, y, tool, variants);
    if (r.rejected) {
      board.shake(x, y);
      announce('Een bron kan alleen op de rand staan.');
      return;
    }
    if (JSON.stringify(r.variants) !== JSON.stringify(variants)) { variants = r.variants; renderTools(); }
    if (!r.changed) return;
    const before = puzzle;
    puzzle = r.puzzle;
    if (first || !strokeStarted) history.push(puzzle); else history.replace(puzzle);
    strokeStarted = true;
    show(diff(before, puzzle));
    const c = puzzle.cells[y * puzzle.width + x];
    announce(`${c.kind === 'empty' ? 'Leeg' : TOOL_NAMES[tool]} op rij ${y + 1}, kolom ${x + 1}.`);
  }

  function bindBoard() {
    board.setPaintMode(true);
    board.setInteractive(true);
    board.onPaint((x, y, phase) => {
      if (phase === 'start') { strokeStarted = false; apply(x, y, true); }
      else if (phase === 'move' && (tool === 'wall' || tool === 'eraser')) apply(x, y, false);
    });
    board.onTap((x, y) => { strokeStarted = false; apply(x, y, true); });
    board.onCursor((x, y) => {
      const c = puzzle.cells[y * puzzle.width + x];
      announce(`Rij ${y + 1}, kolom ${x + 1}: ${c.kind === 'empty' ? 'leeg' : c.kind}.`);
    });
  }

  function undo() { const p = history.undo(); if (p) { const b = puzzle; puzzle = p; show(diff(b, p)); announce('Ongedaan gemaakt.'); } }
  function redo() { const p = history.redo(); if (p) { const b = puzzle; puzzle = p; show(diff(b, p)); announce('Opnieuw gedaan.'); } }

  // ---------- gereedschap ----------
  function selectTool(t: Tool) {
    tool = t;
    renderTools();
    saveDraft({ puzzle, origin, tool, variants });
    announce(`${TOOL_NAMES[t]} gekozen.`);
  }

  function variantButtons(): HTMLElement[] {
    const btn = (label: string, html: string, on: boolean, pick: () => void) =>
      h('button', { class: 'variant', type: 'button', role: 'radio', 'aria-label': label, 'aria-checked': String(on), title: label, html, onClick: () => { pick(); renderTools(); saveDraft({ puzzle, origin, tool, variants }); } });
    switch (tool) {
      case 'crystal': return CRYSTAL_CYCLE.map((c) => btn(COLOR_NAMES[c], crystalSvg(c, 22), variants.crystal === c, () => { variants = { ...variants, crystal: c }; }));
      case 'filter': return FILTER_CYCLE.map((c) => btn(COLOR_NAMES[c], filterSvg(c, 22), variants.filter === c, () => { variants = { ...variants, filter: c }; }));
      case 'mirror': return (['/', '\\'] as const).map((m) => btn(`Spiegel ${m}`, mirrorSvg(m, 22), variants.mirror === m, () => { variants = { ...variants, mirror: m }; }));
      case 'source': return ([0, 1, 2, 3] as const).map((d) => btn(DIR_NAMES[d], sourceSvg(d, 22), variants.source === d, () => { variants = { ...variants, source: d }; }));
      default: return [];
    }
  }

  function renderTools() {
    toolButtons.forEach((b, i) => {
      const t = TOOLS[i];
      const on = t === tool;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      b.innerHTML = toolSvg(t, variants);
    });
    variantsRow.replaceChildren(...variantButtons());
    variantsRow.setAttribute('aria-label', `${TOOL_NAMES[tool]}: keuze`);
    variantsRow.classList.toggle('is-empty', !VARIANT_TOOLS.has(tool));
  }
  toolsRow.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = (TOOLS.indexOf(tool) + step + TOOLS.length) % TOOLS.length;
    selectTool(TOOLS[i]);
    toolButtons[i].focus();
  });

  // ---------- controle ----------
  function infoParts() {
    const errs = errorsOf(puzzle).map(humanError);
    const tips = analysis ? qualityTips(analysis.report) : [];
    return { errs, tips };
  }

  function renderInfo() {
    const { errs, tips } = infoParts();
    const valid = errs.length === 0;
    const max = analysis ? String(analysis.max) : valid ? '…' : '–';
    statusLine.replaceChildren(
      h('span', { class: 'st-max' }, 'Max ', h('b', { class: analysing ? 'is-busy' : '' }, max)),
      h('span', { class: 'st-sep' }, '·'),
      h('span', {}, `${puzzle.mirrors} ${puzzle.mirrors === 1 ? 'spiegel' : 'spiegels'}`),
      h('span', { class: 'st-sep' }, '·'),
      valid ? h('span', { class: 'st-ok' }, '✓ geldig') : h('span', { class: 'st-bad' }, `✗ ${errs[0]}`),
      ...(valid && analysis ? [h('span', { class: 'st-sep' }, '·'), h('span', { class: tips.length ? 'st-tip' : 'st-ok' }, tips.length ? `${tips.length} ${tips.length === 1 ? 'tip' : 'tips'}` : 'geen tips')] : []),
    );
    panel.replaceChildren(panelContent());
    if (panelSheetBody) panelSheetBody.replaceChildren(panelContent());
    const why = valid ? '' : errs[0];
    for (const b of [testBtn, shareBtn, publishBtn]) {
      b.setAttribute('aria-disabled', String(!valid));
      b.classList.toggle('is-off', !valid);
      b.title = why;
    }
    originChip.textContent = originLabel(origin);
  }

  function panelContent(): HTMLElement {
    const { errs, tips } = infoParts();
    const valid = errs.length === 0;
    const rows: (HTMLElement | null)[] = [
      h('p', { class: 'pn-max' }, h('span', { class: 'pn-label' }, 'Max'), h('b', { class: analysing ? 'is-busy' : '' }, analysis ? String(analysis.max) : valid ? '…' : '–'),
        h('span', { class: 'pn-sub' }, `met ${puzzle.mirrors} ${puzzle.mirrors === 1 ? 'spiegel' : 'spiegels'}`)),
      h('p', { class: 'pn-label' }, 'Geldig'),
      h('ul', { class: 'pn-list' }, ...(valid ? [h('li', { class: 'st-ok' }, '✓ Klaar om te spelen')] : errs.map((e) => h('li', { class: 'st-bad' }, `✗ ${e}`)))),
      h('p', { class: 'pn-label' }, 'Tips'),
      h('ul', { class: 'pn-list' }, ...(!valid ? [h('li', { class: 'pn-muted' }, 'Eerst een geldige puzzel')]
        : !analysis ? [h('li', { class: 'pn-muted' }, 'Rekenen…')]
          : tips.length ? tips.map((t) => h('li', { class: 'st-tip' }, `! ${t}`)) : [h('li', { class: 'st-ok' }, '✓ Geen opmerkingen')])),
      h('button', {
        class: 'btn btn-ghost pn-solution', type: 'button', disabled: !analysis,
        onClick: () => (showingSolution ? hideSolution(true) : showSolution()),
      }, showingSolution ? 'Verberg oplossing' : 'Toon oplossing'),
    ];
    return h('div', { class: 'pn' }, ...rows);
  }

  let panelSheetBody: HTMLElement | null = null;
  function openPanelSheet() {
    if (getComputedStyle(panel).display !== 'none') return;
    panelSheetBody = h('div', {}, panelContent());
    openSheet(h('div', { class: 'ed-sheet' }, h('h2', { class: 'sheet-title' }, 'Controle'), panelSheetBody), {
      label: 'Controle', dismissable: true, onClose: () => { panelSheetBody = null; },
    });
  }

  function showSolution() {
    if (!analysis) return;
    showingSolution = true;
    board.setMirrorAlpha(0.55);
    board.update(analysis.solution, trace(puzzle, analysis.solution), { animate: true });
    renderInfo();
    announce(`Beste oplossing: ${analysis.max} kristallen.`);
  }
  function hideSolution(render: boolean) {
    if (!showingSolution) return;
    showingSolution = false;
    board.setMirrorAlpha(1);
    if (render) {
      board.update([], trace(puzzle, []), { animate: false });
      renderInfo();
    }
  }

  function renderHistory() {
    undoBtn.disabled = !history.canUndo;
    redoBtn.disabled = !history.canRedo;
  }

  // ---------- test ----------
  let testExit: (() => void) | null = null;
  function startTest() {
    if (errorsOf(puzzle).length) { announce(`Nog niet te testen: ${humanError(errorsOf(puzzle)[0])}.`); return; }
    testExit = enterTest(api, () => { testExit = null; });
  }

  // ---------- toetsen ----------
  document.addEventListener('keydown', (e) => {
    if (testing || isEditable(e.target) || document.querySelector('.sheet-backdrop')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (!mod && !e.altKey && /^[1-7]$/.test(e.key)) selectTool(TOOLS[Number(e.key) - 1]);
  });

  // ---------- api ----------
  const api: EditorApi = {
    root, board, session, github, testSlot,
    get puzzle() { return puzzle; },
    get origin() { return origin; },
    get dirty() { return JSON.stringify(puzzle) !== clean; },
    get analysis() { return analysis; },
    onAnalysis(cb) { analysisListeners.add(cb); return () => analysisListeners.delete(cb); },
    load(p, o) {
      puzzle = p;
      origin = o;
      clean = JSON.stringify(p);
      history.push(p);
      show();
    },
    edit(p) {
      const b = puzzle;
      puzzle = p;
      history.push(p);
      show(diff(b, p));
    },
    setOrigin(o, isClean = false) {
      origin = o;
      if (isClean) clean = JSON.stringify(puzzle);
      saveDraft({ puzzle, origin, tool, variants });
      renderInfo();
    },
    announce,
    setChip(el) { chipSlot.replaceChildren(...(el ? [el] : [])); },
    setTesting(on) {
      testing = on;
      root.classList.toggle('is-testing', on);
      title.textContent = on ? 'Test' : 'Bouwer';
      backBtn.setAttribute('aria-label', on ? 'Terug naar bouwen' : 'Terug naar het spel');
      requestAnimationFrame(fit);
    },
    bindBoard() {
      bindBoard();
      show();
    },
    fit,
  };

  bindBoard();
  renderTools();
  show();
  addEventListener('resize', fit);
  new ResizeObserver(fit).observe(stage);
  return api;
}
