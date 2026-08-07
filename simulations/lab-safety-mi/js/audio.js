// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Audio Manager
//
// Only mi-theme.mp3 ships with the project. Every sound effect is synthesised
// with the Web Audio API rather than pointing <audio> elements at files that
// do not exist — those produced five 404s on every page load.
// ===================================

class AudioManager {
    constructor() {
        this.musicEnabled = true;
        this.sfxEnabled = true;

        this.bgMusic = document.getElementById('bgMusic');
        if (this.bgMusic) this.bgMusic.volume = 0.28;

        this.initControls();
    }

    // The context is created lazily, on the first real user gesture. Building
    // it at load time only produced a suspended context and console warnings.
    getContext() {
        if (!this.audioContext) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            this.audioContext = new Ctor();
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        return this.audioContext;
    }

    initControls() {
        const musicToggle = document.getElementById('musicToggle');
        const sfxToggle = document.getElementById('sfxToggle');

        if (musicToggle) {
            musicToggle.classList.toggle('muted', !this.musicEnabled);
            musicToggle.setAttribute('aria-pressed', String(this.musicEnabled));
            musicToggle.addEventListener('click', () => this.toggleMusic());
        }

        if (sfxToggle) {
            sfxToggle.classList.toggle('muted', !this.sfxEnabled);
            sfxToggle.setAttribute('aria-pressed', String(this.sfxEnabled));
            sfxToggle.addEventListener('click', () => this.toggleSFX());
        }
    }

    async playMusic() {
        if (!this.musicEnabled) return;

        this.getContext();

        if (this.bgMusic) {
            try {
                await this.bgMusic.play();
                this.usingFileMusic = true;
                return;
            } catch (e) {
                this.usingFileMusic = false;
            }
        }

        this.playThemeFallback();
    }

    stopMusic() {
        this.themeStopped = true;

        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
        }

        if (this.themeTimer) {
            clearTimeout(this.themeTimer);
            this.themeTimer = null;
        }
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;

        const btn = document.getElementById('musicToggle');
        if (btn) {
            btn.classList.toggle('muted', !this.musicEnabled);
            btn.setAttribute('aria-pressed', String(this.musicEnabled));
        }

        if (this.musicEnabled) {
            this.themeStopped = false;
            this.playMusic();
        } else {
            this.stopMusic();
        }
    }

    toggleSFX() {
        this.sfxEnabled = !this.sfxEnabled;

        const btn = document.getElementById('sfxToggle');
        if (btn) {
            btn.classList.toggle('muted', !this.sfxEnabled);
            btn.setAttribute('aria-pressed', String(this.sfxEnabled));
        }
    }

    // ===================================
    // SYNTHESISED EFFECTS
    // ===================================

    tone(freq, duration, type = 'sine', gain = 0.25, startOffset = 0, endFreq = null) {
        const ctx = this.getContext();
        if (!ctx) return;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        const start = ctx.currentTime + startOffset;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, start);
        if (endFreq) {
            oscillator.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
        }

        gainNode.gain.setValueAtTime(gain, start);
        gainNode.gain.exponentialRampToValueAtTime(0.01, start + duration);

        oscillator.start(start);
        oscillator.stop(start + duration);
    }

    noise(duration, gain = 0.45) {
        const ctx = this.getContext();
        if (!ctx) return;

        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            // decaying envelope so it reads as an impact, not a hiss
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, ctx.currentTime);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(gain, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(ctx.currentTime);
        source.stop(ctx.currentTime + duration);
    }

    playBeep() {
        if (!this.sfxEnabled) return;
        this.tone(880, 0.09, 'sine', 0.22);
    }

    playExplosion() {
        if (!this.sfxEnabled) return;
        this.noise(0.65, 0.5);
        this.tone(90, 0.5, 'sawtooth', 0.3, 0, 40);
    }

    playSuccess() {
        if (!this.sfxEnabled) return;
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            this.tone(freq, 0.22, 'sine', 0.18, i * 0.09);
        });
    }

    playFail() {
        if (!this.sfxEnabled) return;
        this.tone(400, 0.32, 'sawtooth', 0.24, 0, 180);
    }

    playAlarm() {
        if (!this.sfxEnabled) return;
        for (let i = 0; i < 3; i++) {
            this.tone(1000, 0.16, 'square', 0.16, i * 0.24);
            this.tone(620, 0.16, 'square', 0.16, i * 0.24 + 0.16);
        }
    }

    // Looping stand-in for the theme when the mp3 will not play.
    playThemeFallback() {
        const ctx = this.getContext();
        if (!ctx) return;

        const melody = [
            { freq: 659.25, duration: 0.2 },
            { freq: 698.46, duration: 0.2 },
            { freq: 659.25, duration: 0.2 },
            { freq: 587.33, duration: 0.2 },
            { freq: 523.25, duration: 0.4 }
        ];

        const playOnce = () => {
            if (!this.musicEnabled || this.themeStopped) return;

            let offset = 0.1;
            melody.forEach(note => {
                this.tone(note.freq, note.duration, 'sine', 0.16, offset);
                offset += note.duration + 0.05;
            });

            this.themeTimer = setTimeout(playOnce, 2500);
        };

        playOnce();
    }
}

window.audioManager = new AudioManager();
