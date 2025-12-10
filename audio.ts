// Helper to manage voices state
let voices: SpeechSynthesisVoice[] = [];

export const initVoices = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const load = () => {
    voices = window.speechSynthesis.getVoices();
  };

  load();
  
  // Chrome/Android loads voices asynchronously
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = load;
  }
};

export const playSound = (type: 'grab' | 'drop' | 'rustle') => {
  // Safe check for SSR or environments without AudioContext
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  if (type === 'grab' || type === 'drop') {
    // "Bul'k" - Water drop/bubble sound
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    
    // Frequency sweep down for a "bloop" effect
    // Start mid-low, drop low quickly
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
    
    // Volume envelope: Attack fast, decay fast
    // Much quieter (0.1 max gain)
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.25);

  } else if (type === 'rustle') {
    // Rustling sound (filtered noise) - Quiet
    const bufferSize = ctx.sampleRate * 0.2; // 200ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    
    noise.connect(filter);
    filter.connect(gain);
    
    // Very quiet rustle
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    
    noise.start(now);
  }
};

export const speakText = (text: string) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Cancel any currently playing speech to avoid overlapping
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
  utterance.lang = 'ru-RU';
  utterance.rate = 0.9; // Slightly slower for clarity
  utterance.volume = 1.0; // Ensure max volume

  // Ensure voices are loaded if array is empty
  if (voices.length === 0) {
    voices = window.speechSynthesis.getVoices();
  }

  // Try to find a Russian voice
  // Priority: Google Russian -> Any ru-RU -> Any ru
  const ruVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('ru')) 
               || voices.find(v => v.lang === 'ru-RU') 
               || voices.find(v => v.lang.startsWith('ru'));
               
  if (ruVoice) {
    utterance.voice = ruVoice;
  }

  window.speechSynthesis.speak(utterance);
};