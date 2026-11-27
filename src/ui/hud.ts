import type { SoundState } from '../audio/hkSoundscape';

export type PresetName = 'dusk' | 'midnight' | 'dawn';
export type CameraView = 'iso' | 'tram' | 'street';
export type ViewMode = 'diorama' | 'acoustic' | 'print';
export type LangCode = 'zh' | 'en';

export interface HudCallbacks {
  onPreset: (preset: PresetName) => void;
  onCamera: (view: CameraView) => void;
  onMode: (mode: ViewMode) => void;
  onExportSvg: () => void;
  onBell: () => void;
  onToggleSound: () => SoundState;
}

const LABELS = {
  zh: {
    title: '香江雨霧・叮叮',
    seal: '灣仔道',
    subtitle: '港島叮叮 · 觀塘線高架 · 雨夜街角',
    dusk: '夕霧',
    midnight: '深夜',
    dawn: '晨霧',
    iso: '等軸',
    tram: '叮叮',
    street: '街角',
    acoustic: '聲場',
    print: '線稿',
    exportSvg: '匯出 SVG',
    bell: '鳴鈴',
    soundIdle: '聲音',
    soundOn: '聲音開',
    soundOff: '靜音',
    lang: 'EN',
    github: 'GitHub 源碼 ↗︎',
    hint: '拖曳旋轉 · 滾輪縮放 · 點擊車輛鳴笛'
  },
  en: {
    title: 'TRAMLINE MIST',
    seal: 'HK',
    subtitle: 'WAN CHAI & KWUN TONG · RAINY CORNER',
    dusk: 'Dusk',
    midnight: 'Midnight',
    dawn: 'Dawn',
    iso: 'Iso',
    tram: 'Tram',
    street: 'Street',
    acoustic: 'Acoustic',
    print: 'Line Art',
    exportSvg: 'SVG',
    bell: 'Bell',
    soundIdle: 'Sound',
    soundOn: 'Sound On',
    soundOff: 'Muted',
    lang: '繁中',
    github: 'GitHub Source ↗︎',
    hint: 'Drag orbit · Scroll zoom · Click vehicles'
  }
} as const;

export class DioramaHud {
  private root: HTMLDivElement;
  private titleMainEl!: HTMLDivElement;
  private titleSubEl!: HTMLDivElement;
  private hintEl!: HTMLDivElement;
  private githubLabelEl!: HTMLSpanElement;
  private presetBtns = new Map<PresetName, HTMLButtonElement>();
  private cameraBtns = new Map<CameraView, HTMLButtonElement>();
  private acousticBtn!: HTMLButtonElement;
  private printBtn!: HTMLButtonElement;
  private svgExportBtn!: HTMLButtonElement;
  private bellBtn!: HTMLButtonElement;
  private soundBtn!: HTMLButtonElement;
  private langBtn!: HTMLButtonElement;

  private lang: LangCode;
  private currentPreset: PresetName = 'dusk';
  private currentCamera: CameraView = 'iso';
  private currentMode: ViewMode = 'diorama';
  private soundState: SoundState = 'idle';
  private idleTimer: number | null = null;

  constructor(
    container: HTMLElement,
    private callbacks: HudCallbacks,
    initialLang: LangCode = 'en'
  ) {
    this.lang = initialLang;
    this.root = document.createElement('div');
    this.root.className = 'hud-root';

    this.buildDom();
    container.appendChild(this.root);
    this.renderText();
    this.syncState();
    this.setupIdleFade();
  }

  private syncLangToUrl(): void {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', this.lang);
      window.history.replaceState(null, '', url.toString());
    } catch {
      // Ignore history API restrictions on opaque origins
    }
  }

  public setLang(lang: LangCode): void {
    this.lang = lang;
    this.renderText();
    this.syncLangToUrl();
  }

  public getLang(): LangCode {
    return this.lang;
  }

  private buildDom(): void {
    const title = document.createElement('div');
    title.className = 'hud-title';

    this.titleMainEl = document.createElement('div');
    this.titleMainEl.className = 'hud-title-main';
    this.titleSubEl = document.createElement('div');
    this.titleSubEl.className = 'hud-title-sub';

    title.append(this.titleMainEl, this.titleSubEl);

    const dock = document.createElement('nav');
    dock.className = 'hud-dock';
    dock.setAttribute('aria-label', 'Diorama controls');

    // Atmosphere presets
    const presetGroup = document.createElement('div');
    presetGroup.className = 'hud-group';
    const presets: Array<[PresetName, string]> = [
      ['dusk', '1'],
      ['midnight', '2'],
      ['dawn', '3']
    ];
    for (const [preset, key] of presets) {
      const btn = this.makeBtn(key, () => this.callbacks.onPreset(preset));
      this.presetBtns.set(preset, btn);
      presetGroup.appendChild(btn);
    }

    // Camera presets
    const camGroup = document.createElement('div');
    camGroup.className = 'hud-group';
    const cams: Array<[CameraView, string]> = [
      ['iso', 'Q'],
      ['tram', 'W'],
      ['street', 'E']
    ];
    for (const [view, key] of cams) {
      const btn = this.makeBtn(key, () => this.callbacks.onCamera(view));
      this.cameraBtns.set(view, btn);
      camGroup.appendChild(btn);
    }

    // View modes (+ built-in SVG export button visible only in [P] Print mode)
    const modeGroup = document.createElement('div');
    modeGroup.className = 'hud-group';
    this.acousticBtn = this.makeBtn('A', () => {
      this.callbacks.onMode(this.currentMode === 'acoustic' ? 'diorama' : 'acoustic');
    });
    this.printBtn = this.makeBtn('P', () => {
      this.callbacks.onMode(this.currentMode === 'print' ? 'diorama' : 'print');
    });
    this.svgExportBtn = this.makeBtn('↓', () => {
      this.callbacks.onExportSvg();
    });
    this.svgExportBtn.id = 'btn-export-svg';
    this.svgExportBtn.classList.add('hud-btn-svg', 'hud-btn-hidden');
    this.svgExportBtn.hidden = true;
    modeGroup.append(this.acousticBtn, this.printBtn, this.svgExportBtn);

    // Actions
    const actionGroup = document.createElement('div');
    actionGroup.className = 'hud-group';
    this.bellBtn = this.makeBtn('␣', () => this.callbacks.onBell());
    this.soundBtn = this.makeBtn('M', () => {
      this.soundState = this.callbacks.onToggleSound();
      this.renderText();
      this.syncState();
    });
    this.soundBtn.id = 'btn-sound-toggle';
    this.langBtn = this.makeBtn('', () => {
      this.lang = this.lang === 'zh' ? 'en' : 'zh';
      this.renderText();
      this.syncLangToUrl();
    });
    actionGroup.append(this.bellBtn, this.soundBtn, this.langBtn);

    dock.append(
      presetGroup,
      this.makeSep(),
      camGroup,
      this.makeSep(),
      modeGroup,
      this.makeSep(),
      actionGroup
    );

    const topRight = document.createElement('div');
    topRight.className = 'hud-topright';

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'hud-hint';

    const githubLink = document.createElement('a');
    githubLink.id = 'link-github-source';
    githubLink.className = 'hud-source-link';
    githubLink.href = 'https://github.com/h-void/hk-tram-mist';
    githubLink.target = '_blank';
    githubLink.rel = 'noopener noreferrer';
    githubLink.innerHTML =
      '<svg class="hud-github-mark" viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';
    this.githubLabelEl = document.createElement('span');
    githubLink.appendChild(this.githubLabelEl);

    topRight.append(this.hintEl, githubLink);

    this.root.append(title, dock, topRight);
  }

  private makeBtn(shortcut: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hud-btn';
    btn.dataset.shortcut = shortcut;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.bumpActivity();
      onClick();
    });
    return btn;
  }

  private makeSep(): HTMLDivElement {
    const sep = document.createElement('div');
    sep.className = 'hud-sep';
    return sep;
  }

  private setBtnLabel(btn: HTMLButtonElement, label: string): void {
    const shortcut = btn.dataset.shortcut ?? '';
    const keyName = shortcut === '␣' ? 'Space' : shortcut === '↓' ? '' : shortcut;
    btn.setAttribute('aria-label', keyName ? `${label} (${keyName})` : label);
    btn.innerHTML = shortcut
      ? `<span class="hud-key" aria-hidden="true">${shortcut}</span><span>${label}</span>`
      : `<span>${label}</span>`;
  }

  private renderText(): void {
    const t = LABELS[this.lang];
    document.documentElement.lang = this.lang === 'zh' ? 'zh-HK' : 'en';
    this.titleMainEl.innerHTML = `<span>${t.title}</span><span class="hud-title-seal">${t.seal}</span>`;
    this.titleSubEl.textContent = t.subtitle;
    this.hintEl.textContent = t.hint;
    this.githubLabelEl.textContent = t.github;

    this.setBtnLabel(this.presetBtns.get('dusk')!, t.dusk);
    this.setBtnLabel(this.presetBtns.get('midnight')!, t.midnight);
    this.setBtnLabel(this.presetBtns.get('dawn')!, t.dawn);

    this.setBtnLabel(this.cameraBtns.get('iso')!, t.iso);
    this.setBtnLabel(this.cameraBtns.get('tram')!, t.tram);
    this.setBtnLabel(this.cameraBtns.get('street')!, t.street);

    this.setBtnLabel(this.acousticBtn, t.acoustic);
    this.setBtnLabel(this.printBtn, t.print);
    this.setBtnLabel(this.svgExportBtn, t.exportSvg);
    this.setBtnLabel(this.bellBtn, t.bell);
    const soundLabel =
      this.soundState === 'on'
        ? t.soundOn
        : this.soundState === 'muted'
        ? t.soundOff
        : t.soundIdle;
    this.setBtnLabel(this.soundBtn, soundLabel);
    this.setBtnLabel(this.langBtn, t.lang);
  }

  private syncState(): void {
    for (const [preset, btn] of this.presetBtns) {
      const active = preset === this.currentPreset;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    for (const [cam, btn] of this.cameraBtns) {
      const active = cam === this.currentCamera;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    const acousticActive = this.currentMode === 'acoustic';
    const printActive = this.currentMode === 'print';
    this.acousticBtn.classList.toggle('active-cyan', acousticActive);
    this.acousticBtn.setAttribute('aria-pressed', acousticActive ? 'true' : 'false');
    this.printBtn.classList.toggle('active', printActive);
    this.printBtn.setAttribute('aria-pressed', printActive ? 'true' : 'false');
    this.svgExportBtn.hidden = !printActive;
    this.svgExportBtn.classList.toggle('hud-btn-hidden', !printActive);
    const soundOn = this.soundState === 'on';
    this.soundBtn.classList.toggle('active-cyan', soundOn);
    this.soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    document.body.classList.toggle('mode-print', printActive);
  }

  public setState(state: {
    preset?: PresetName;
    camera?: CameraView;
    mode?: ViewMode;
    soundState?: SoundState;
    soundEnabled?: boolean;
  }): void {
    if (state.preset) this.currentPreset = state.preset;
    if (state.camera) this.currentCamera = state.camera;
    if (state.mode) this.currentMode = state.mode;
    if (state.soundState !== undefined) {
      this.soundState = state.soundState;
    } else if (state.soundEnabled !== undefined) {
      this.soundState = state.soundEnabled ? 'on' : 'muted';
    }
    this.renderText();
    this.syncState();
  }

  public setVisible(visible: boolean): void {
    this.root.classList.toggle('hud-hidden', !visible);
    if (visible) {
      this.bumpActivity();
    }
  }

  private setupIdleFade(): void {
    const wake = () => this.bumpActivity();
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    window.addEventListener('touchstart', wake, { passive: true });
    window.addEventListener('keydown', wake, { passive: true });
    this.bumpActivity();
  }

  public bumpActivity(): void {
    this.root.classList.remove('hud-idle');
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
    }
    this.idleTimer = window.setTimeout(() => {
      this.root.classList.add('hud-idle');
    }, 7500);
  }
}
