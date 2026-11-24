export type PresetName = 'dusk' | 'midnight' | 'dawn';
export type CameraView = 'iso' | 'tram' | 'street';
export type ViewMode = 'diorama' | 'acoustic' | 'print';
export type LangCode = 'zh' | 'en';

export interface HudCallbacks {
  onPreset: (preset: PresetName) => void;
  onCamera: (view: CameraView) => void;
  onMode: (mode: ViewMode) => void;
  onBell: () => void;
  onToggleSound: () => boolean;
}

const LABELS = {
  zh: {
    title: '香江雨霧・叮叮',
    seal: '灣仔道',
    subtitle: 'HONG KONG SPATIAL MEMORY · 1988—2026',
    dusk: '夕霧',
    midnight: '深夜',
    dawn: '晨霧',
    iso: '等軸',
    tram: '叮叮',
    street: '街角',
    acoustic: '聲場',
    print: '版畫',
    bell: '鳴鈴',
    soundOn: '雨聲開',
    soundOff: '靜音',
    lang: 'EN',
    hint: '拖曳旋轉 · 滾輪縮放 · 點擊車輛鳴笛'
  },
  en: {
    title: 'TRAMLINE MIST',
    seal: 'HK',
    subtitle: 'COMPRESSED HONG KONG MEMORY · PROCEDURAL 3D',
    dusk: 'Dusk',
    midnight: 'Midnight',
    dawn: 'Dawn',
    iso: 'Iso',
    tram: 'Tram',
    street: 'Street',
    acoustic: 'Acoustic',
    print: 'Print',
    bell: 'Bell',
    soundOn: 'Sound',
    soundOff: 'Muted',
    lang: '繁中',
    hint: 'Drag orbit · Scroll zoom · Click vehicles'
  }
} as const;

export class DioramaHud {
  private root: HTMLDivElement;
  private titleMainEl!: HTMLDivElement;
  private titleSubEl!: HTMLDivElement;
  private hintEl!: HTMLDivElement;
  private presetBtns = new Map<PresetName, HTMLButtonElement>();
  private cameraBtns = new Map<CameraView, HTMLButtonElement>();
  private acousticBtn!: HTMLButtonElement;
  private printBtn!: HTMLButtonElement;
  private bellBtn!: HTMLButtonElement;
  private soundBtn!: HTMLButtonElement;
  private langBtn!: HTMLButtonElement;

  private lang: LangCode;
  private currentPreset: PresetName = 'dusk';
  private currentCamera: CameraView = 'iso';
  private currentMode: ViewMode = 'diorama';
  private soundEnabled = false;
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

  public setLang(lang: LangCode): void {
    this.lang = lang;
    this.renderText();
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

    // View modes
    const modeGroup = document.createElement('div');
    modeGroup.className = 'hud-group';
    this.acousticBtn = this.makeBtn('A', () => {
      this.callbacks.onMode(this.currentMode === 'acoustic' ? 'diorama' : 'acoustic');
    });
    this.printBtn = this.makeBtn('P', () => {
      this.callbacks.onMode(this.currentMode === 'print' ? 'diorama' : 'print');
    });
    modeGroup.append(this.acousticBtn, this.printBtn);

    // Actions
    const actionGroup = document.createElement('div');
    actionGroup.className = 'hud-group';
    this.bellBtn = this.makeBtn('␣', () => this.callbacks.onBell());
    this.soundBtn = this.makeBtn('M', () => {
      this.soundEnabled = this.callbacks.onToggleSound();
      this.renderText();
      this.syncState();
    });
    this.langBtn = this.makeBtn('', () => {
      this.lang = this.lang === 'zh' ? 'en' : 'zh';
      this.renderText();
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

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'hud-hint';

    this.root.append(title, dock, this.hintEl);
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
    btn.innerHTML = shortcut
      ? `<span class="hud-key">${shortcut}</span><span>${label}</span>`
      : `<span>${label}</span>`;
  }

  private renderText(): void {
    const t = LABELS[this.lang];
    document.documentElement.lang = this.lang === 'zh' ? 'zh-HK' : 'en';
    this.titleMainEl.innerHTML = `<span>${t.title}</span><span class="hud-title-seal">${t.seal}</span>`;
    this.titleSubEl.textContent = t.subtitle;
    this.hintEl.textContent = t.hint;

    this.setBtnLabel(this.presetBtns.get('dusk')!, t.dusk);
    this.setBtnLabel(this.presetBtns.get('midnight')!, t.midnight);
    this.setBtnLabel(this.presetBtns.get('dawn')!, t.dawn);

    this.setBtnLabel(this.cameraBtns.get('iso')!, t.iso);
    this.setBtnLabel(this.cameraBtns.get('tram')!, t.tram);
    this.setBtnLabel(this.cameraBtns.get('street')!, t.street);

    this.setBtnLabel(this.acousticBtn, t.acoustic);
    this.setBtnLabel(this.printBtn, t.print);
    this.setBtnLabel(this.bellBtn, t.bell);
    this.setBtnLabel(this.soundBtn, this.soundEnabled ? t.soundOn : t.soundOff);
    this.setBtnLabel(this.langBtn, t.lang);
  }

  private syncState(): void {
    for (const [preset, btn] of this.presetBtns) {
      btn.classList.toggle('active', preset === this.currentPreset);
    }
    for (const [cam, btn] of this.cameraBtns) {
      btn.classList.toggle('active', cam === this.currentCamera);
    }
    this.acousticBtn.classList.toggle('active-cyan', this.currentMode === 'acoustic');
    this.printBtn.classList.toggle('active', this.currentMode === 'print');
    this.soundBtn.classList.toggle('active-cyan', this.soundEnabled);
    document.body.classList.toggle('mode-print', this.currentMode === 'print');
  }

  public setState(state: {
    preset?: PresetName;
    camera?: CameraView;
    mode?: ViewMode;
    soundEnabled?: boolean;
  }): void {
    if (state.preset) this.currentPreset = state.preset;
    if (state.camera) this.currentCamera = state.camera;
    if (state.mode) this.currentMode = state.mode;
    if (state.soundEnabled !== undefined) this.soundEnabled = state.soundEnabled;
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
