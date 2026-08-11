const AudioEngine = {
  ctx: null,
  init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
  playTone(freq, dur, type='square', vol=0.1) {
    this.init();
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(this.ctx.destination); o.start();
    setTimeout(() => o.stop(), dur);
  },
  playClick()   { this.playTone(800,50,'square',0.05); },
  playSuccess() { this.playTone(523,100,'square',0.08); setTimeout(()=>this.playTone(659,150,'square',0.08),100); },
  playError()   { this.playTone(200,300,'sawtooth',0.1); },
  playLevelUp() { [523,659,784,1047].forEach((n,i)=>setTimeout(()=>this.playTone(n,200,'square',0.1),i*150)); },
  playEpic()    { [300,400,600,900,1200].forEach((n,i)=>setTimeout(()=>this.playTone(n,80,'sawtooth',0.3),i*40)); },
  playStreak()  { [600,800,1000,1200].forEach((n,i)=>setTimeout(()=>this.playTone(n,100,'square',0.12),i*80)); },
  playShop()    { this.playTone(440,80,'square',0.07); setTimeout(()=>this.playTone(550,120,'square',0.07),90); }
};

// 🎵 MÚSICA
var bgMusic = null;
var musicEnabled = true;

function initMusic() {
  bgMusic = new Audio(GITHUB+'/angevin.mp3');
  bgMusic.loop = true;
  bgMusic.volume = 0.25;
}

function playMusic() {
  if (!bgMusic) initMusic();
  bgMusic.play().catch(function() {
    document.addEventListener('click', function() {
      if (musicEnabled && bgMusic.paused) bgMusic.play();
    }, { once: true });
  });
}

function toggleMusic() {
  if (!bgMusic) initMusic();
  musicEnabled = !musicEnabled;
  if (musicEnabled) {
    bgMusic.play().catch(function(){});
  } else {
    bgMusic.pause();
  }
}
