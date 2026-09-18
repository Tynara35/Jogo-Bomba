// ======================================================
//  Áudio — música de fundo + efeitos sonoros
//  Tudo gerado via Web Audio API (sem arquivos externos)
// ======================================================

const Audio = {
  ctx: null,
  musicGain: null,
  sfxGain: null,
  musicPlaying: false,
  musicTimer: null,
  musicaLigada: true,
  sfxLigado: true,

  // ---------- Volumes persistidos ----------
  getVolumeMusica() {
    const v = parseFloat(localStorage.getItem('boom_vol_musica'));
    return isNaN(v) ? 0.09 : v;
  },
  setVolumeMusica(v) {
    localStorage.setItem('boom_vol_musica', String(v));
    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.value = v;
    }
  },
  getVolumeSfx() {
    const v = parseFloat(localStorage.getItem('boom_vol_sfx'));
    return isNaN(v) ? 0.32 : v;
  },
  setVolumeSfx(v) {
    localStorage.setItem('boom_vol_sfx', String(v));
    if (this.sfxGain) {
      this.sfxGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.sfxGain.gain.value = v;
    }
  },

  // ---------- Init ----------
  init() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.getVolumeMusica();
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.getVolumeSfx();
    this.sfxGain.connect(this.ctx.destination);
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  // ---------- Nota genérica ----------
  nota(freq, quando, dur, tipo = 'sine', vol = 0.2, destino = null) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, quando);
    g.gain.linearRampToValueAtTime(vol, quando + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
    osc.connect(g).connect(destino || this.sfxGain);
    osc.start(quando);
    osc.stop(quando + dur + 0.05);
  },

  // ---------- Ruído (para explosão) ----------
  ruido(quando, dur, vol) {
    if (!this.ctx) return;
    const tamanho = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, tamanho, this.ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < tamanho; i++) {
      dados[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / tamanho, 2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(2000, quando);
    filtro.frequency.exponentialRampToValueAtTime(80, quando + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, quando);
    g.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
    src.connect(filtro).connect(g).connect(this.sfxGain);
    src.start(quando);
    src.stop(quando + dur);
  },

  // ---------- Efeitos ----------
  acerto() {
    if (!this.sfxLigado || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.nota(660, t, 0.12, 'sine', 0.25);
    this.nota(880, t + 0.1, 0.18, 'sine', 0.25);
    this.nota(1320, t + 0.2, 0.25, 'sine', 0.2);
  },

  erro() {
    if (!this.sfxLigado || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.nota(220, t, 0.2, 'sawtooth', 0.25);
    this.nota(165, t + 0.15, 0.35, 'sawtooth', 0.25);
  },

  explosao() {
    if (!this.sfxLigado || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.ruido(t, 1.2, 0.5);
    this.nota(60, t, 0.6, 'sine', 0.4);
    this.nota(90, t + 0.05, 0.5, 'sine', 0.3);
  },

  tick() {
    if (!this.sfxLigado || !this.ctx) return;
    this.nota(1000, this.ctx.currentTime, 0.05, 'square', 0.08);
  },

  vitoria() {
    if (!this.sfxLigado || !this.ctx) return;
    const t = this.ctx.currentTime;
    const notas = [523.25, 659.25, 783.99, 1046.5];
    notas.forEach((f, i) => this.nota(f, t + i * 0.12, 0.3, 'triangle', 0.22));
  },

  // ---------- Música de fundo ----------
  // Progressão: Am — F — C — G
  PROGRESSAO: [
    { baixo: 110.00, notas: [220.00, 261.63, 329.63] },  // Am
    { baixo: 87.31,  notas: [174.61, 220.00, 261.63] },  // F
    { baixo: 130.81, notas: [261.63, 329.63, 392.00] },  // C
    { baixo: 98.00,  notas: [196.00, 246.94, 293.66] }   // G
  ],

  tocarMusica() {
    if (!this.musicaLigada || !this.ctx) return;
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this._loopMusica();
  },

  pararMusica() {
    this.musicPlaying = false;
    clearTimeout(this.musicTimer);
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
      setTimeout(() => {
        if (this.musicGain) this.musicGain.gain.value = this.getVolumeMusica();
      }, 400);
    }
  },

  _loopMusica() {
    if (!this.musicPlaying || !this.ctx) return;
    const t = this.ctx.currentTime;
    const bpm = 90;
    const beat = 60 / bpm;
    const compasso = 4 * beat;

    this.PROGRESSAO.forEach((acorde, i) => {
      const inicio = t + i * compasso;
      this.nota(acorde.baixo, inicio, compasso * 0.9, 'sine', 0.35, this.musicGain);
      acorde.notas.forEach((f, j) => {
        const quando = inicio + j * (compasso / 3);
        this.nota(f, quando, compasso / 3 * 0.85, 'triangle', 0.12, this.musicGain);
      });
    });

    const duracao = compasso * 4 * 1000;
    this.musicTimer = setTimeout(() => this._loopMusica(), duracao - 500);
  },

  toggleMusica() {
    this.musicaLigada = !this.musicaLigada;
    localStorage.setItem('boom_musica', this.musicaLigada ? '1' : '0');
    if (this.musicaLigada) {
      this.resume();
      this.tocarMusica();
    } else {
      this.pararMusica();
    }
    return this.musicaLigada;
  },

  carregarPreferencias() {
    this.musicaLigada = localStorage.getItem('boom_musica') !== '0';
    this.sfxLigado = localStorage.getItem('boom_sfx') !== '0';
  }
};