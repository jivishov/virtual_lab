// voiceAssistant.js - Natural Human-Cadence Procedure Narration & Hands-Free "Why?" Voice Commands
// Prioritizes studio-grade Neural/Natural voices (Edge Natural, Chrome Google, Apple Enhanced/Premium),
// normalizes chemistry notation into fluent human English, and prevents mic echo while speaking.

let hooks = {};
let selectedVoice = null;
let voicesLoaded = false;

let isSpeaking = false;
let speechQueueId = 0;

let recognition = null;
let micActive = false;       // User toggled voice commands ON
let micPausedForTts = false; // Temporarily paused while app is speaking to prevent self-echo
let micRestartTimer = null;
let lastCommandMs = 0;
let lastSpokenText = '';

const COMMAND_COOLDOWN_MS = 1200;

// ---------------------------------------------------------------------------
// 1. Neural / Natural Human Voice Selection Engine (Avoids Robotic SAPI5 Voices!)
// ---------------------------------------------------------------------------

function scoreVoiceNaturalness(voice) {
    if (!voice || !voice.lang) return -999;
    const lang = voice.lang.toLowerCase();
    if (!lang.startsWith('en')) return -500;

    const name = (voice.name || '').toLowerCase();
    let score = 0;

    // Tier 1: Neural / Natural studio voices (Windows Edge Online Natural, Apple Premium, etc.)
    if (/\b(natural|neural)\b/.test(name)) score += 160;
    if (/(aria|ava|emma|andrew|brian|jenny|guy|sonia|ryan|libby|steffan|michelle|ana)\b/.test(name)) score += 95;
    if (/online/.test(name) && /english/.test(name)) score += 65;

    // Tier 2: High-quality Google / Apple Enhanced / Premium human voices
    if (/google us english/.test(name)) score += 115;
    if (/google uk english female/.test(name)) score += 110;
    if (/google uk english male/.test(name)) score += 105;
    if (/(premium|enhanced|siri)/.test(name)) score += 90;
    if (/(samantha|serena|zoe|allison|karen|moira|tessa|daniel|oliver|kate)/.test(name)) score += 68;

    // Cloud-rendered voices on Chrome/Edge are dramatically more human than legacy local SAPI5
    if (voice.localService === false) score += 32;

    // Strongly demote robotic legacy desktop synthesizers so they are only last-resort fallbacks
    if (/(espeak|festival|mbrola|speechd|pico)/.test(name)) score -= 140;
    if (/microsoft\s+(david|zira|mark|hazel|george|susan|heera|ravi)\b/.test(name) && !/natural|online/.test(name)) {
        score -= 75;
    }
    if (/\bdesktop\b/.test(name)) score -= 45;

    // Gentle dialect preference for clear scientific en-US / en-GB pronunciation
    if (lang === 'en-us') score += 12;
    else if (lang === 'en-gb') score += 10;
    else if (lang === 'en-au' || lang === 'en-ca') score += 6;

    return score;
}

function resolveBestNaturalVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return null;

    voicesLoaded = true;
    let best = null;
    let bestScore = -Infinity;
    for (const v of voices) {
        const sc = scoreVoiceNaturalness(v);
        if (sc > bestScore) {
            bestScore = sc;
            best = v;
        }
    }
    selectedVoice = best;
    return best;
}

export function getActiveVoiceName() {
    const v = selectedVoice || resolveBestNaturalVoice();
    if (!v) return 'Default System Voice';
    return v.name.replace(/\s*-\s*English\s*\([^)]+\)/i, '').trim();
}

// ---------------------------------------------------------------------------
// 2. Chemistry-Aware Human Prosody Preprocessor
// ---------------------------------------------------------------------------

export function formatChemistryForSpeech(rawText) {
    if (!rawText) return '';
    let t = String(rawText)
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, ' and ')
        .replace(/\s+/g, ' ')
        .trim();

    // Remove UI micro-button labels that might sneak in (e.g., "Peek Step")
    t = t.replace(/\bPeek Step\b/gi, '').trim();

    // Friendly pronunciation of laboratory reagents, formulas & optical instruments
    t = t
        .replace(/Spectronic\s*20D\+/gi, 'Spectronic 20 D Plus')
        .replace(/\bSpec\s*20D\+/gi, 'Spectronic 20 D Plus')
        .replace(/\bSpec\s*20\b/gi, 'Spectronic 20')
        .replace(/\bDistilled\s+H[₂2]O\b/gi, 'distilled water')
        .replace(/\bWater\s*\(H[₂2]O\)/gi, 'water')
        .replace(/\bH[₂2]O\b/g, 'water')
        .replace(/\bBlue\s*#\s*1\b/gi, 'Blue One')
        .replace(/\bFD&C\b/gi, 'F D and C')
        .replace(/\bλ\s*max\b/gi, 'lambda max')
        .replace(/λ\s*=\s*/g, 'wavelength ')
        .replace(/λ/g, 'wavelength')
        .replace(/ε/g, 'molar absorptivity epsilon')
        .replace(/−\s*log[₁1][₀0]\s*\(\s*T\s*\)/gi, 'negative log base 10 of transmittance')
        .replace(/-\s*log[₁1][₀0]\s*\(\s*T\s*\)/gi, 'negative log base 10 of transmittance')
        .replace(/−\s*log\s*\(\s*T\s*\)/gi, 'negative log of transmittance')
        .replace(/-\s*log\s*\(\s*T\s*\)/gi, 'negative log of transmittance')
        .replace(/\bM[₁1]\s*[·*×]\s*V[₁1]\s*=\s*M[₂2]\s*[·*×]\s*V[₂2]/g, 'M 1 V 1 equals M 2 V 2')
        .replace(/\bM[₂2]\s*=/g, 'final concentration M 2 equals')
        .replace(/\bM[₁1]\b/g, 'M 1')
        .replace(/\bM[₂2]\b/g, 'M 2')
        .replace(/\bV[₁1]\b/g, 'V 1')
        .replace(/\bV[₂2]\b/g, 'V 2')
        .replace(/\bI[₀0]\b/g, 'I zero')
        .replace(/\bA\s*=\s*m\s*[·*×]\s*c\b/g, 'absorbance equals slope m times concentration')
        .replace(/\bA\s*=\s*molar absorptivity epsilon\s*[·*×]\s*b\s*[·*×]\s*c\b/g, 'absorbance equals epsilon times path length b times concentration c')
        .replace(/\bc\s*=\s*A\s*\/\s*m\b/g, 'concentration equals absorbance divided by slope m')
        .replace(/\bR[²2]\b/g, 'R squared')
        .replace(/(\d+(?:\.\d+)?)\s*%\s*T\b/g, '$1 percent transmittance')
        .replace(/%\s*T\b/g, 'percent transmittance')
        .replace(/\b1\s*mL\b/g, '1 milliliter')
        .replace(/(\d+(?:\.\d+)?)\s*mL\b/g, '$1 milliliters')
        .replace(/\bµM\b|µM/g, 'micromolar')
        .replace(/\buM\b/g, 'micromolar')
        .replace(/\bmg\/L\b/g, 'milligrams per liter')
        .replace(/\bAbs\/µM\b|Abs\/micromolar/gi, 'absorbance units per micromolar')
        .replace(/\bAbs\b/g, 'absorbance')
        .replace(/\bnm\b/g, 'nanometers')
        .replace(/\bcm\b/g, 'centimeters')
        // Dilution ratios like 10/0, 8/2, 6/4, 4/6, 2/8, 0/10
        .replace(/\b(10\/0|8\/2|6\/4|4\/6|2\/8|0\/10)\b/g, (m) => m.replace('/', ' to '))
        // Fractional dilution factor like (8/10)
        .replace(/\((\d+)\s*\/\s*(\d+)\)/g, '$1 divided by $2')
        // Operators into conversational speech
        .replace(/\s*×\s*/g, ' times ')
        .replace(/\s*·\s*/g, ' times ')
        .replace(/\s*≈\s*/g, ' is approximately ')
        .replace(/\s*→\s*/g, ' to ')
        .replace(/\s*=\s*/g, ' equals ')
        .replace(/'([^']+)'/g, '$1')
        .replace(/:\s+/g, '. ')
        .replace(/\s+/g, ' ')
        .trim();

    return t;
}

function splitIntoNaturalSentences(text) {
    const cleaned = formatChemistryForSpeech(text);
    if (!cleaned) return [];
    const parts = cleaned
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    return parts.length > 0 ? parts : [cleaned];
}

// ---------------------------------------------------------------------------
// 3. On-Demand Natural Human Speech Playback
// ---------------------------------------------------------------------------

function notifySpeechState(speaking) {
    isSpeaking = speaking;
    if (typeof hooks.onSpeakingChange === 'function') {
        hooks.onSpeakingChange(speaking, getActiveVoiceName());
    }
}

export function stopSpeaking() {
    speechQueueId++;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
            window.speechSynthesis.cancel();
        } catch {}
    }
    if (isSpeaking) {
        notifySpeechState(false);
    }
    if (micActive && micPausedForTts) {
        resumeRecognitionAfterSpeech();
    }
}

export function speakNatural(rawText, { onDone = null } = {}) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        hooks.onToast?.('Voice playback is not supported in this browser.', 'info');
        return false;
    }

    const sentences = splitIntoNaturalSentences(rawText);
    if (sentences.length === 0) return false;

    const myQueueId = ++speechQueueId;
    lastSpokenText = sentences.join(' ');

    try {
        window.speechSynthesis.cancel();
    } catch {}

    // Pause speech recognition while speaking so the mic never hears our own voice!
    if (micActive && recognition) {
        micPausedForTts = true;
        try {
            recognition.abort();
        } catch {}
    }

    const voice = selectedVoice || resolveBestNaturalVoice();
    const isNeural = voice && /\b(natural|neural|online)\b|google/i.test(voice.name || '');

    notifySpeechState(true);

    let idx = 0;
    const speakNext = () => {
        if (myQueueId !== speechQueueId) return;
        if (idx >= sentences.length) {
            notifySpeechState(false);
            if (micActive && micPausedForTts) {
                resumeRecognitionAfterSpeech();
            }
            if (typeof onDone === 'function') onDone();
            return;
        }

        const u = new SpeechSynthesisUtterance(sentences[idx]);
        if (voice) {
            u.voice = voice;
            u.lang = voice.lang || 'en-US';
        } else {
            u.lang = 'en-US';
        }
        // Unhurried, conversational human lab-instructor pacing (never rushed robotic cadence)
        u.rate = isNeural ? 0.96 : 0.93;
        u.pitch = 1.0;
        u.volume = 0.96;

        u.onend = () => {
            if (myQueueId !== speechQueueId) return;
            idx++;
            // Brief natural breathing pause between clauses (90 ms)
            if (idx < sentences.length) {
                setTimeout(speakNext, 90);
            } else {
                speakNext();
            }
        };

        u.onerror = () => {
            if (myQueueId !== speechQueueId) return;
            notifySpeechState(false);
            if (micActive && micPausedForTts) {
                resumeRecognitionAfterSpeech();
            }
        };

        try {
            window.speechSynthesis.speak(u);
        } catch {
            notifySpeechState(false);
        }
    };

    speakNext();
    return true;
}

export function isVoiceSpeaking() {
    return isSpeaking;
}

// ---------------------------------------------------------------------------
// 4. Hands-Free Voice Command Recognition ("Why?", "Read step", "Focus", etc.)
// ---------------------------------------------------------------------------

function getSpeechRecognitionCtor() {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isVoiceRecognitionSupported() {
    return Boolean(getSpeechRecognitionCtor());
}

function notifyMicState(active, statusText = '') {
    if (typeof hooks.onListeningChange === 'function') {
        hooks.onListeningChange(active, statusText);
    }
}

function resumeRecognitionAfterSpeech() {
    if (micRestartTimer) {
        clearTimeout(micRestartTimer);
        micRestartTimer = null;
    }
    micRestartTimer = setTimeout(() => {
        micRestartTimer = null;
        micPausedForTts = false;
        if (micActive && recognition && !isSpeaking) {
            try {
                recognition.start();
            } catch {}
        }
    }, 280);
}

export function handleVoiceTranscript(transcript, isFinal = true) {
    const clean = String(transcript || '').trim().toLowerCase();
    if (!clean) return null;

    const now = performance.now();
    if (now - lastCommandMs < COMMAND_COOLDOWN_MS) return null;

    // 1. "Why?" / "Why do we..." / "Explain" -> Opens & voices the written chemistry explanation!
    if (/\b(why|explain|reason|why do we|why does|what is the science)\b/i.test(clean)) {
        lastCommandMs = now;
        hooks.onAskWhy?.(clean);
        return 'why';
    }

    // Wait for final transcript for secondary commands to avoid false mid-sentence triggers
    if (!isFinal) return null;

    if (/\b(stop|quiet|silence|mute voice|cancel)\b/i.test(clean)) {
        lastCommandMs = now;
        stopSpeaking();
        return 'stop';
    }

    if (/\b(read|procedure|repeat|current step|what next|what should i do|next step)\b/i.test(clean)) {
        lastCommandMs = now;
        hooks.onReadStep?.(clean);
        return 'read';
    }

    if (/\b(show me|demonstrate|demo)\b/i.test(clean)) {
        lastCommandMs = now;
        hooks.onShowMe?.(clean);
        return 'show';
    }

    if (/\b(focus|where is|guide)\b/i.test(clean)) {
        lastCommandMs = now;
        hooks.onFocus?.(clean);
        return 'focus';
    }

    if (/\b(undo|go back)\b/i.test(clean)) {
        lastCommandMs = now;
        hooks.onUndo?.(clean);
        return 'undo';
    }

    return null;
}

export function startVoiceListening() {
    if (micActive) return true;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
        hooks.onToast?.('Voice commands require Chrome or Edge speech recognition. Click the speaker icons anytime for on-demand narration!', 'info');
        notifyMicState(false, 'Unsupported');
        return false;
    }

    try {
        if (!recognition) {
            recognition = new Ctor();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                if (isSpeaking || micPausedForTts) return;
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const res = event.results[i];
                    const txt = res[0]?.transcript || '';
                    const handled = handleVoiceTranscript(txt, res.isFinal);
                    if (handled) break;
                }
            };

            recognition.onerror = (event) => {
                const err = event?.error || '';
                if (err === 'not-allowed' || err === 'service-not-allowed') {
                    micActive = false;
                    notifyMicState(false, 'Mic blocked');
                    hooks.onToast?.('Microphone permission denied — allow mic access to ask "Why?" by voice, or click Why? → Listen.', 'error');
                } else if (err === 'audio-capture') {
                    micActive = false;
                    notifyMicState(false, 'No mic');
                    hooks.onToast?.('No microphone detected — click the speaker buttons for on-demand narration.', 'info');
                }
                // 'no-speech' and 'aborted' are normal during pauses; onend handles clean restart
            };

            recognition.onend = () => {
                if (micActive && !micPausedForTts && !isSpeaking) {
                    if (micRestartTimer) clearTimeout(micRestartTimer);
                    micRestartTimer = setTimeout(() => {
                        micRestartTimer = null;
                        if (micActive && recognition && !micPausedForTts && !isSpeaking) {
                            try {
                                recognition.start();
                            } catch {}
                        }
                    }, 220);
                }
            };
        }

        micActive = true;
        micPausedForTts = false;
        recognition.start();
        notifyMicState(true, 'Listening ("Why?")');
        hooks.onToast?.('Voice Assistant listening — say "Why?" for a spoken chemistry explanation, or "Read step".', 'success');
        return true;
    } catch (err) {
        console.warn('[VoiceAssistant] Failed to start recognition:', err);
        micActive = false;
        notifyMicState(false, 'Unavailable');
        return false;
    }
}

export function stopVoiceListening(silent = false) {
    micActive = false;
    micPausedForTts = false;
    if (micRestartTimer) {
        clearTimeout(micRestartTimer);
        micRestartTimer = null;
    }
    if (recognition) {
        try {
            recognition.abort();
        } catch {}
    }
    notifyMicState(false, 'Off');
    if (!silent) {
        hooks.onToast?.('Voice command microphone turned off.', 'info');
    }
}

export function toggleVoiceListening() {
    if (micActive) {
        stopVoiceListening(false);
        return false;
    }
    return startVoiceListening();
}

export function getVoiceStatus() {
    return {
        speaking: isSpeaking,
        listening: micActive,
        voiceName: getActiveVoiceName(),
        recognitionSupported: isVoiceRecognitionSupported(),
        lastSpokenText,
    };
}

export function initVoiceAssistant(callbacks = {}) {
    hooks = callbacks || {};
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        resolveBestNaturalVoice();
        window.speechSynthesis.addEventListener?.('voiceschanged', () => {
            resolveBestNaturalVoice();
        });
    }
    window.addEventListener('beforeunload', () => {
        stopSpeaking();
        stopVoiceListening(true);
    });
}
