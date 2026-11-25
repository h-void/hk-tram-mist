/**
 * Pure Web Audio API procedural Hong Kong rainy-night soundscape:
 * - Filtered stereo rain bed + tin-roof pitter-patter droplets
 * - Subtle 50/100Hz Hong Kong neon transformer hum
 * - Distant steel rail rumble modulated by tram & metro proximity
 * - Authentic Hong Kong double-decker tram metallic double-ding bell ("叮叮!")
 */

export class HKSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  private humGain: GainNode | null = null;
  private dropletTimer: number | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private unlocked = false;
  private muted = true; // Starts silent until user gesture or unmute toggle
  private userExplicitlyMuted = false;

  public unlockAndStart(autoUnmute = false): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.setupGraph();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.unlocked = true;
    if (autoUnmute && !this.userExplicitlyMuted) {
      this.setMuted(false);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.userExplicitlyMuted = muted;
    if (!muted && !this.unlocked) {
      this.unlockAndStart(false);
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0.0 : 0.42, now, 0.18);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return !this.muted;
  }

  private setupGraph(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.0;
    this.masterGain.connect(ctx.destination);

    // Pre-generate 3s pink-ish noise buffer
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 3;
    const buffer = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
        b6 = white * 0.115926;
      }
    }
    this.noiseBuffer = buffer;

    // 1. Steady rainy dusk bed
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;

    const rainHP = ctx.createBiquadFilter();
    rainHP.type = 'highpass';
    rainHP.frequency.value = 520;

    const rainLP = ctx.createBiquadFilter();
    rainLP.type = 'lowpass';
    rainLP.frequency.value = 3900;

    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.34;

    // Gentle breeze swell LFO
    const breezeLfo = ctx.createOscillator();
    breezeLfo.frequency.value = 0.11;
    const breezeDepth = ctx.createGain();
    breezeDepth.gain.value = 420;
    breezeLfo.connect(breezeDepth);
    breezeDepth.connect(rainLP.frequency);
    breezeLfo.start();

    rainSource.connect(rainHP);
    rainHP.connect(rainLP);
    rainLP.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    rainSource.start();

    // 2. Subtle Hong Kong 50Hz / 100Hz neon ballast hum
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0.018;

    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 220;

    const osc50 = ctx.createOscillator();
    osc50.type = 'sine';
    osc50.frequency.value = 50;

    const osc100 = ctx.createOscillator();
    osc100.type = 'triangle';
    osc100.frequency.value = 100;
    const osc100Gain = ctx.createGain();
    osc100Gain.gain.value = 0.45;

    osc50.connect(humFilter);
    osc100.connect(osc100Gain);
    osc100Gain.connect(humFilter);
    humFilter.connect(this.humGain);
    this.humGain.connect(this.masterGain);
    osc50.start();
    osc100.start();

    // 3. Distant tram / elevated rail steel rumble
    const rumbleSource = ctx.createBufferSource();
    rumbleSource.buffer = buffer;
    rumbleSource.loop = true;

    const rumbleLP = ctx.createBiquadFilter();
    rumbleLP.type = 'bandpass';
    rumbleLP.frequency.value = 105;
    rumbleLP.Q.value = 1.6;

    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0.08;

    rumbleSource.connect(rumbleLP);
    rumbleLP.connect(this.rumbleGain);
    this.rumbleGain.connect(this.masterGain);
    rumbleSource.start();

    // 4. Tin-roof / awning raindrop pitter-patter scheduler
    this.dropletTimer = window.setInterval(() => {
      if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted || this.ctx.state !== 'running') {
        return;
      }
      if (Math.random() < 0.62) {
        this.spawnTinDroplet();
      }
    }, 150);
  }

  private spawnTinDroplet(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1850 + Math.random() * 2400;
    bp.Q.value = 5.5 + Math.random() * 5.0;

    const env = ctx.createGain();
    const peak = 0.025 + Math.random() * 0.045;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(peak, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.045 + Math.random() * 0.03);

    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 1.4;

    src.connect(bp);
    bp.connect(env);
    env.connect(pan);
    pan.connect(this.masterGain);

    src.start(now, Math.random() * 2.5, 0.09);
  }

  public updateMotion(tramProximity: number, trainProximity: number, rainIntensity = 1.0): void {
    if (!this.ctx || !this.rumbleGain || !this.rainGain) return;
    const now = this.ctx.currentTime;
    const rumbleLevel = 0.05 + tramProximity * 0.16 + trainProximity * 0.24;
    this.rumbleGain.gain.setTargetAtTime(rumbleLevel, now, 0.12);
    this.rainGain.gain.setTargetAtTime(0.2 + rainIntensity * 0.18, now, 0.25);
  }

  /**
   * Authentic Hong Kong Tramways metallic foot-gong double-ding ("叮叮!").
   * Always audible when explicitly triggered by clicking the tram or pressing Space
   * (if audio context is running or after gesture unlock).
   */
  public ringTramBell(): void {
    if (this.userExplicitlyMuted) return;
    if (!this.unlocked) {
      this.unlockAndStart(false);
    }
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime + 0.015;
    this.strikeBell(now, 1285, 0.26);
    this.strikeBell(now + 0.165, 1302, 0.30);
  }

  private strikeBell(startTime: number, fundamental: number, gainLevel: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const bus = ctx.createGain();
    bus.gain.value = gainLevel;
    bus.connect(ctx.destination);

    // Metallic brass tram-gong partial ratios
    const partials: Array<[number, number, number]> = [
      [1.0, 1.0, 1.15],
      [2.02, 0.42, 0.72],
      [2.97, 0.24, 0.48],
      [4.19, 0.14, 0.32],
      [5.46, 0.07, 0.20]
    ];

    for (const [ratio, amp, decay] of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * ratio, startTime);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, startTime);
      env.gain.linearRampToValueAtTime(amp * 0.35, startTime + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

      osc.connect(env);
      env.connect(bus);
      osc.start(startTime);
      osc.stop(startTime + decay + 0.04);
    }

    // Brief metallic hammer transient click
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(3400, startTime);
    clickOsc.frequency.exponentialRampToValueAtTime(980, startTime + 0.014);
    const clickEnv = ctx.createGain();
    clickEnv.gain.setValueAtTime(0.28, startTime);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.018);
    clickOsc.connect(clickEnv);
    clickEnv.connect(bus);
    clickOsc.start(startTime);
    clickOsc.stop(startTime + 0.025);
  }

  /**
   * Brief polite dual-tone Hong Kong minibus / Crown Comfort taxi horn chirp
   * triggered when clicking the green-roof minibus or parked red taxi.
   */
  public ringVehicleHorn(variant: 'minibus' | 'taxi' = 'taxi'): void {
    if (this.userExplicitlyMuted) return;
    if (!this.unlocked) {
      this.unlockAndStart(false);
    }
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const freqs = variant === 'minibus' ? [392, 494] : [440, 554];
    const dur = variant === 'minibus' ? 0.16 : 0.12;

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.linearRampToValueAtTime(0.085, now + 0.012);
    bus.gain.setValueAtTime(0.085, now + dur - 0.03);
    bus.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1450;
    bus.connect(lp);
    lp.connect(ctx.destination);

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.connect(bus);
      osc.start(now);
      osc.stop(now + dur + 0.03);
    }
  }

  public dispose(): void {
    if (this.dropletTimer !== null) {
      window.clearInterval(this.dropletTimer);
      this.dropletTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
