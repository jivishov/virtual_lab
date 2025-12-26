// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Audio Manager
// ===================================

class AudioManager {
    constructor() {
        this.musicEnabled = true;
        this.sfxEnabled = true;

        // Get audio elements
        this.bgMusic = document.getElementById('bgMusic');
        this.beepSound = document.getElementById('beepSound');
        this.explosionSound = document.getElementById('explosionSound');
        this.successSound = document.getElementById('successSound');
        this.failSound = document.getElementById('failSound');
        this.alarmSound = document.getElementById('alarmSound');

        // Set volumes
        if (this.bgMusic) this.bgMusic.volume = 0.3;
        if (this.beepSound) this.beepSound.volume = 0.4;
        if (this.explosionSound) this.explosionSound.volume = 0.5;
        if (this.successSound) this.successSound.volume = 0.5;
        if (this.failSound) this.failSound.volume = 0.5;
        if (this.alarmSound) this.alarmSound.volume = 0.4;

        // Initialize controls
        this.initControls();

        // Use Web Audio API fallback for beeps if audio files not available
        this.initWebAudio();
    }

    initWebAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('AudioContext created, state:', this.audioContext.state);

            // Resume context on user interaction if suspended
            if (this.audioContext.state === 'suspended') {
                console.log('AudioContext suspended, will resume on user interaction');
            }
        } catch (e) {
            console.error('Web Audio API not supported:', e);
        }
    }

    initControls() {
        const musicToggle = document.getElementById('musicToggle');
        const sfxToggle = document.getElementById('sfxToggle');

        if (musicToggle) {
            musicToggle.addEventListener('click', () => {
                this.toggleMusic();
            });
        }

        if (sfxToggle) {
            sfxToggle.addEventListener('click', () => {
                this.toggleSFX();
            });
        }
    }

    async playMusic() {
        console.log('=== PLAY MUSIC CALLED ===');

        // Resume AudioContext if suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
            console.log('Resuming suspended AudioContext...');
            try {
                await this.audioContext.resume();
                console.log('AudioContext resumed, state:', this.audioContext.state);
            } catch (e) {
                console.error('Failed to resume AudioContext:', e);
            }
        }

        if (this.bgMusic && this.musicEnabled) {
            console.log('Trying to play bgMusic element...');
            // Try to play music
            const playPromise = this.bgMusic.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('✓ Music started successfully from audio element');
                    })
                    .catch((error) => {
                        console.warn('✗ Background music blocked or not found:', error.message);
                        // Fallback to Web Audio synthesized theme
                        this.playMIThemeFallback();
                    });
            }
        } else if (!this.bgMusic && this.musicEnabled) {
            // No audio element, use fallback
            console.log('No audio element found, using synthesized MI theme');
            this.playMIThemeFallback();
        } else if (!this.musicEnabled) {
            console.log('Music is disabled');
        }
    }

    stopMusic() {
        // Stop looping theme by disabling music
        const wasEnabled = this.musicEnabled;
        this.musicEnabled = false;

        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
        }

        // Re-enable for next play
        setTimeout(() => {
            this.musicEnabled = wasEnabled;
        }, 100);
    }

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        const btn = document.getElementById('musicToggle');

        if (btn) {
            btn.classList.toggle('muted', !this.musicEnabled);
        }

        if (this.musicEnabled) {
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
        }
    }

    playBeep() {
        if (!this.sfxEnabled) return;

        if (this.beepSound) {
            this.beepSound.currentTime = 0;
            this.beepSound.play().catch(() => {
                this.playBeepFallback();
            });
        } else {
            this.playBeepFallback();
        }
    }

    playExplosion() {
        if (!this.sfxEnabled) return;

        if (this.explosionSound) {
            this.explosionSound.currentTime = 0;
            this.explosionSound.play().catch(() => {
                this.playExplosionFallback();
            });
        } else {
            this.playExplosionFallback();
        }
    }

    playSuccess() {
        if (!this.sfxEnabled) return;

        if (this.successSound) {
            this.successSound.currentTime = 0;
            this.successSound.play().catch(() => {
                this.playSuccessFallback();
            });
        } else {
            this.playSuccessFallback();
        }
    }

    playFail() {
        if (!this.sfxEnabled) return;

        if (this.failSound) {
            this.failSound.currentTime = 0;
            this.failSound.play().catch(() => {
                this.playFailFallback();
            });
        } else {
            this.playFailFallback();
        }
    }

    playAlarm() {
        if (!this.sfxEnabled) return;

        if (this.alarmSound) {
            this.alarmSound.currentTime = 0;
            this.alarmSound.play().catch(() => {
                this.playAlarmFallback();
            });
        } else {
            this.playAlarmFallback();
        }
    }

    // Web Audio API fallback sounds
    playBeepFallback() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    playExplosionFallback() {
        if (!this.audioContext) return;

        const bufferSize = this.audioContext.sampleRate * 0.5;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const gainNode = this.audioContext.createGain();
        noise.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

        noise.start(this.audioContext.currentTime);
        noise.stop(this.audioContext.currentTime + 0.5);
    }

    playSuccessFallback() {
        if (!this.audioContext) return;

        const notes = [523.25, 659.25, 783.99]; // C, E, G
        notes.forEach((freq, index) => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.value = freq;
            oscillator.type = 'sine';

            const startTime = this.audioContext.currentTime + (index * 0.1);
            gainNode.gain.setValueAtTime(0.2, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.2);
        });
    }

    playFailFallback() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.3);
        oscillator.type = 'sawtooth';

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }

    playAlarmFallback() {
        if (!this.audioContext) return;

        for (let i = 0; i < 3; i++) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            const startTime = this.audioContext.currentTime + (i * 0.4);

            oscillator.frequency.setValueAtTime(1000, startTime);
            oscillator.frequency.setValueAtTime(600, startTime + 0.2);
            oscillator.type = 'square';

            gainNode.gain.setValueAtTime(0.2, startTime);
            gainNode.gain.setValueAtTime(0, startTime + 0.4);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.4);
        }
    }

    playMIThemeFallback() {
        // Simple MI theme melody fallback
        if (!this.audioContext) {
            console.error('No AudioContext available for MI theme');
            return;
        }

        if (this.audioContext.state !== 'running') {
            console.warn('AudioContext not running, state:', this.audioContext.state);
            return;
        }

        console.log('🎵 Playing synthesized MI theme (looping)');

        const melody = [
            { freq: 659.25, duration: 0.2 }, // E
            { freq: 698.46, duration: 0.2 }, // F
            { freq: 659.25, duration: 0.2 }, // E
            { freq: 587.33, duration: 0.2 }, // D
            { freq: 523.25, duration: 0.4 },  // C
        ];

        const playMelody = () => {
            if (!this.musicEnabled) {
                console.log('Music disabled, stopping theme');
                return;
            }

            if (this.audioContext.state !== 'running') {
                console.warn('AudioContext stopped, state:', this.audioContext.state);
                return;
            }

            console.log('🔊 Playing melody iteration...');
            let currentTime = this.audioContext.currentTime + 0.1;

            melody.forEach(note => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.frequency.value = note.freq;
                oscillator.type = 'sine'; // Changed to sine for smoother sound

                // Increased volume significantly
                gainNode.gain.setValueAtTime(0.2, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + note.duration);

                oscillator.start(currentTime);
                oscillator.stop(currentTime + note.duration);

                currentTime += note.duration + 0.05;
            });

            // Loop the melody every 2.5 seconds
            if (this.musicEnabled) {
                setTimeout(playMelody, 2500);
            }
        };

        playMelody();
    }
}

// Initialize audio manager
window.audioManager = new AudioManager();
