// Variables to control game state
let gameRunning = false; // Keeps track of whether game is active or not
let blueDropMaker; // Timer for blue drops
let brownDropMaker; // Timer for brown drops
let powerUpMaker; // Timer for power-up drops
let timerTicker; // Timer for elapsed game time
let score = 0;
let lives = 3;
let isDraggingCan = false;
let elapsedSeconds = 0;
let dropFallDuration = 4;
let brownDropInterval = 3000;
let highScore = 0;
let currentMode = "easy";
let activeModeSettings = null;
let audioContext = null;
let lastGlowScore = 0;
let milestoneTimer = null;
let slowTimeTimeout = null;
let doubleScoreTimeout = null;
let shieldCharges = 0;
let scoreMultiplier = 1;
let slowTimeActive = false;
const reachedMilestones = new Set();

const MODE_SETTINGS = {
  easy: {
    brownInterval: 3000,
    speedUpEverySeconds: 12,
    dropDurationStep: 0.4,
    minDropDuration: 1.9,
    brownIntervalStep: 220,
    minBrownInterval: 900,
  },
  medium: {
    brownInterval: 2200,
    speedUpEverySeconds: 10,
    dropDurationStep: 0.5,
    minDropDuration: 1.6,
    brownIntervalStep: 300,
    minBrownInterval: 700,
  },
  hard: {
    brownInterval: 1500,
    speedUpEverySeconds: 7,
    dropDurationStep: 0.6,
    minDropDuration: 1.3,
    brownIntervalStep: 360,
    minBrownInterval: 500,
  },
};

const SCORE_GLOW_STEP = 50;
const BASE_BLUE_POINTS = 10;
const POWERUP_SPAWN_INTERVAL = 7000;
const SLOW_TIME_MULTIPLIER = 1.6;
const SLOW_TIME_DURATION_MS = 5000;
const DOUBLE_SCORE_DURATION_MS = 6000;
const MAX_SHIELD_CHARGES = 3;
const POWERUP_TYPES = ["shield", "slow", "double"];
const POWERUP_BASE_SIZE = 95;
const POWERUP_SPEED_MULTIPLIER = 0.72;
const SCORE_MILESTONES = [
  { score: 50, message: "Great start! 50 points." },
  { score: 100, message: "100 points! Keep it flowing." },
  { score: 150, message: "150 points! Nice catch streak." },
  { score: 200, message: "200 points! Water hero mode." },
  { score: 300, message: "300 points! Unstoppable." },
  { score: 400, message: "400 points! Legendary run." },
  { score: 500, message: "500 points! Incredible." },
];

const gameContainer = document.getElementById("game-container");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const timeEl = document.getElementById("time");
const waterCan = document.getElementById("water-can");
const gameOverOverlay = document.getElementById("game-over-overlay");
const finalScoreEl = document.getElementById("final-score");
const highScoreEl = document.getElementById("high-score");
const highScoreHudEl = document.getElementById("high-score-hud");
const newHighscoreBanner = document.getElementById("new-highscore-banner");
const gameOverTitle = document.getElementById("game-over-title");
const startOverlay = document.getElementById("start-overlay");
const milestoneMessageEl = document.getElementById("milestone-message");
const confettiCanvas = document.getElementById("confetti-canvas");
const confettiCtx = confettiCanvas.getContext("2d");
const modeSelectStart = document.getElementById("mode-select-start");
const modeSelectEnd = document.getElementById("mode-select-end");
let confettiParticles = [];
let confettiRaf = null;

function triggerScoreGlow() {
  scoreEl.classList.remove("score-glow");
  void scoreEl.offsetWidth;
  scoreEl.classList.add("score-glow");
}

function showMilestoneMessage(message) {
  if (!milestoneMessageEl) return;

  milestoneMessageEl.textContent = message;
  milestoneMessageEl.classList.add("visible");

  if (milestoneTimer) {
    clearTimeout(milestoneTimer);
  }

  milestoneTimer = setTimeout(() => {
    milestoneMessageEl.classList.remove("visible");
  }, 1800);
}

function resetMilestoneProgress() {
  reachedMilestones.clear();
  lastGlowScore = 0;

  if (milestoneTimer) {
    clearTimeout(milestoneTimer);
    milestoneTimer = null;
  }

  if (milestoneMessageEl) {
    milestoneMessageEl.textContent = "";
    milestoneMessageEl.classList.remove("visible");
  }
}

function updateScoreMilestones() {
  if (score > 0 && score % SCORE_GLOW_STEP === 0 && score !== lastGlowScore) {
    lastGlowScore = score;
    triggerScoreGlow();
  }

  for (const milestone of SCORE_MILESTONES) {
    if (score >= milestone.score && !reachedMilestones.has(milestone.score)) {
      reachedMilestones.add(milestone.score);
      showMilestoneMessage(milestone.message);
    }
  }
}

function clearEffectTimers() {
  if (slowTimeTimeout) {
    clearTimeout(slowTimeTimeout);
    slowTimeTimeout = null;
  }

  if (doubleScoreTimeout) {
    clearTimeout(doubleScoreTimeout);
    doubleScoreTimeout = null;
  }
}

function resetPowerUps() {
  clearEffectTimers();
  shieldCharges = 0;
  scoreMultiplier = 1;
  slowTimeActive = false;
}

function playPowerUpSound() {
  playTone({ frequency: 740, duration: 0.08, volume: 0.03, type: "square" });
  playTone({ frequency: 990, duration: 0.1, volume: 0.028, type: "square", delay: 0.05 });
}

function activatePowerUp(powerType) {
  if (powerType === "shield") {
    shieldCharges = Math.min(MAX_SHIELD_CHARGES, shieldCharges + 1);
    showMilestoneMessage(`Shield ready (${shieldCharges})`);
    playPowerUpSound();
    return;
  }

  if (powerType === "slow") {
    if (slowTimeTimeout) {
      clearTimeout(slowTimeTimeout);
    }

    slowTimeActive = true;
    showMilestoneMessage("Slow Time active: 5s");
    playPowerUpSound();

    slowTimeTimeout = setTimeout(() => {
      slowTimeActive = false;
      slowTimeTimeout = null;
    }, SLOW_TIME_DURATION_MS);
    return;
  }

  if (powerType === "double") {
    if (doubleScoreTimeout) {
      clearTimeout(doubleScoreTimeout);
    }

    scoreMultiplier = 2;
    showMilestoneMessage("Double Score active: 6s");
    playPowerUpSound();

    doubleScoreTimeout = setTimeout(() => {
      scoreMultiplier = 1;
      doubleScoreTimeout = null;
    }, DOUBLE_SCORE_DURATION_MS);
  }
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playTone({
  frequency,
  duration,
  volume,
  type = "sine",
  slideTo,
  delay = 0,
}) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);

  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playGoodDropSound() {
  playTone({ frequency: 600, slideTo: 900, duration: 0.1, volume: 0.04, type: "triangle" });
  playTone({ frequency: 900, slideTo: 1200, duration: 0.11, volume: 0.035, type: "triangle", delay: 0.05 });
}

function playBadDropSound() {
  playTone({ frequency: 240, slideTo: 170, duration: 0.2, volume: 0.055, type: "sawtooth" });
}

function playStartGameSound() {
  playTone({ frequency: 390, duration: 0.12, volume: 0.035, type: "square" });
  playTone({ frequency: 520, duration: 0.12, volume: 0.035, type: "square", delay: 0.08 });
  playTone({ frequency: 780, duration: 0.15, volume: 0.03, type: "triangle", delay: 0.16 });
}

function playGameOverSound() {
  playTone({ frequency: 420, slideTo: 260, duration: 0.18, volume: 0.045, type: "sine" });
  playTone({ frequency: 260, slideTo: 150, duration: 0.28, volume: 0.05, type: "sine", delay: 0.14 });
}

function playNewHighScoreSound() {
  // Punchy sports-style fanfare with rhythmic brass-like stabs.
  playTone({ frequency: 392.0, duration: 0.1, volume: 0.05, type: "sawtooth" });
  playTone({ frequency: 523.25, duration: 0.1, volume: 0.044, type: "sawtooth", delay: 0.01 });
  playTone({ frequency: 659.25, duration: 0.1, volume: 0.04, type: "sawtooth", delay: 0.02 });

  playTone({ frequency: 392.0, duration: 0.1, volume: 0.05, type: "sawtooth", delay: 0.15 });
  playTone({ frequency: 523.25, duration: 0.1, volume: 0.044, type: "sawtooth", delay: 0.16 });
  playTone({ frequency: 659.25, duration: 0.1, volume: 0.04, type: "sawtooth", delay: 0.17 });

  playTone({ frequency: 783.99, duration: 0.12, volume: 0.045, type: "square", delay: 0.32 });
  playTone({ frequency: 987.77, duration: 0.12, volume: 0.042, type: "square", delay: 0.41 });
  playTone({ frequency: 1174.66, duration: 0.18, volume: 0.04, type: "square", delay: 0.5 });

  playTone({ frequency: 783.99, slideTo: 1046.5, duration: 0.2, volume: 0.032, type: "triangle", delay: 0.63 });
  playTone({ frequency: 987.77, slideTo: 1318.51, duration: 0.24, volume: 0.03, type: "triangle", delay: 0.68 });
}

function setMode(mode) {
  if (!MODE_SETTINGS[mode]) return;
  currentMode = mode;
  activeModeSettings = MODE_SETTINGS[mode];
  modeSelectStart.value = mode;
  modeSelectEnd.value = mode;
}

modeSelectStart.addEventListener("change", (event) => {
  setMode(event.target.value);
});

modeSelectEnd.addEventListener("change", (event) => {
  setMode(event.target.value);
});

setMode(currentMode);

document.getElementById("reset-btn").addEventListener("click", () => {
  stopConfetti();
  gameOverOverlay.classList.add("hidden");
  startGame();
});

// Wait for button click to start the game
document.getElementById("start-btn").addEventListener("click", startGame);

function startGame() {
  // Prevent multiple games from running at once
  if (gameRunning) return;

  const selectedMode = modeSelectStart.value || currentMode;
  setMode(selectedMode);

  score = 0;
  lives = 3;
  elapsedSeconds = 0;
  dropFallDuration = 4;
  brownDropInterval = MODE_SETTINGS[currentMode].brownInterval;
  activeModeSettings = MODE_SETTINGS[currentMode];
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  timeEl.textContent = elapsedSeconds;
  resetMilestoneProgress();
  resetPowerUps();
  gameRunning = true;
  playStartGameSound();
  startOverlay.classList.add("hidden");
  centerCan();
  createGoodDrop();

  // Blue drops spawn every second.
  blueDropMaker = setInterval(createGoodDrop, 1000);

  // Brown drops spawn frequency depends on selected mode.
  brownDropMaker = setInterval(createBadDrop, brownDropInterval);

  // Rare power-ups spawn periodically.
  powerUpMaker = setInterval(createPowerUpDrop, POWERUP_SPAWN_INTERVAL);

  // Timer counts up from 0 and increases difficulty based on selected mode.
  timerTicker = setInterval(() => {
    elapsedSeconds += 1;
    timeEl.textContent = elapsedSeconds;

    if (elapsedSeconds % activeModeSettings.speedUpEverySeconds === 0) {
      // Increase drop fall speed.
      if (dropFallDuration > activeModeSettings.minDropDuration) {
        dropFallDuration = Math.max(
          activeModeSettings.minDropDuration,
          dropFallDuration - activeModeSettings.dropDurationStep
        );
      }

      // Increase brown drop frequency by restarting its interval shorter.
      if (brownDropInterval > activeModeSettings.minBrownInterval) {
        brownDropInterval = Math.max(
          activeModeSettings.minBrownInterval,
          brownDropInterval - activeModeSettings.brownIntervalStep
        );
        clearInterval(brownDropMaker);
        brownDropMaker = setInterval(createBadDrop, brownDropInterval);
      }
    }
  }, 1000);
}

function createGoodDrop() {
  // Create a new div element that will be our water drop
  const drop = document.createElement("div");
  drop.className = "water-drop-blue"; // Use the blue drop style
  drop.dataset.dropType = "blue";

  startDrop(drop);
}

function createBadDrop() {
  const baddrop = document.createElement("div");
  baddrop.className = "water-drop-brown"; // Use the brown drop style
  baddrop.dataset.dropType = "brown";
  startDrop(baddrop);
}

function createPowerUpDrop() {
  const randomType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  const powerDrop = document.createElement("div");
  powerDrop.className = `water-drop-powerup water-drop-powerup-${randomType}`;
  powerDrop.dataset.dropType = "powerup";
  powerDrop.dataset.powerType = randomType;

  if (randomType === "shield") {
    powerDrop.textContent = "S";
  } else if (randomType === "slow") {
    powerDrop.textContent = "T";
  } else {
    powerDrop.textContent = "2X";
  }

  startDrop(powerDrop);
}

function startDrop( drop ) {
  // Make drops different sizes for visual variety
  const isPowerUp = drop.dataset.dropType === "powerup";
  const initialSize = isPowerUp ? POWERUP_BASE_SIZE : 170;
  const sizeMultiplier = isPowerUp
    ? (Math.random() * 0.35 + 0.65)
    : (Math.random() * 0.8 + 0.5);
  const size = initialSize * sizeMultiplier;
  drop.style.width = drop.style.height = `${size}px`;
  

  // Position the drop randomly across the game width
  // Keep drops fully inside the container based on actual drop size.
  const gameWidth = document.getElementById("game-container").offsetWidth;
  const maxX = Math.max(0, gameWidth - size);
  const xPosition = Math.random() * maxX;
  drop.style.left = xPosition + "px";

  // Make drops fall faster over time, with temporary slow-time support.
  const durationMultiplier = slowTimeActive ? SLOW_TIME_MULTIPLIER : 1;
  const powerUpDurationMultiplier = isPowerUp ? POWERUP_SPEED_MULTIPLIER : 1;
  drop.style.animationDuration = `${dropFallDuration * durationMultiplier * powerUpDurationMultiplier}s`;

  // Add the new drop to the game screen
  gameContainer.appendChild(drop);

  let handled = false;

  const handleCatch = () => {
    if (handled || !drop.isConnected || !isDropTouchingCan(drop)) return;

    handled = true;
    if (drop.dataset.dropType === "blue") {
      score += BASE_BLUE_POINTS * scoreMultiplier;
      scoreEl.textContent = score;
      updateScoreMilestones();
      playGoodDropSound();
    } else if (drop.dataset.dropType === "brown") {
      if (shieldCharges > 0) {
        shieldCharges -= 1;
        showMilestoneMessage(`Shield blocked hit (${shieldCharges} left)`);
      } else {
        lives -= 1;
        livesEl.textContent = lives;
        playBadDropSound();
      }

      if (lives <= 0) {
        endGame();
      }
    } else if (drop.dataset.dropType === "powerup") {
      activatePowerUp(drop.dataset.powerType);
    }

    drop.remove();
  };

  // Check collision repeatedly while the drop is falling.
  const collisionWatcher = setInterval(() => {
    if (handled || !drop.isConnected || !gameRunning) {
      clearInterval(collisionWatcher);
      return;
    }

    handleCatch();
  }, 40);

  // Ensure cleanup when the drop reaches the bottom.
  drop.addEventListener("animationend", () => {
    clearInterval(collisionWatcher);
    handleCatch();

    if (!handled && drop.isConnected) {
      drop.remove(); // Clean up drops that weren't caught
    }
  });
}

function getCanHitboxRect() {
  const rect = waterCan.getBoundingClientRect();

  // Keep collision centered on the visible can body/opening.
  const leftInset = rect.width * 0.30;
  const rightInset = rect.width * 0.30;
  const topInset = rect.height * 0.45;
  const bottomInset = rect.height * 0.14;

  return {
    left: rect.left + leftInset,
    right: rect.right - rightInset,
    top: rect.top + topInset,
    bottom: rect.bottom - bottomInset,
  };
}

function isDropTouchingCan(drop) {
  const dropRect = getDropHitboxRect(drop);
  const canHitbox = getCanHitboxRect();

  return (
    dropRect.left < canHitbox.right &&
    dropRect.right > canHitbox.left &&
    dropRect.top < canHitbox.bottom &&
    dropRect.bottom > canHitbox.top
  );
}

function getDropHitboxRect(drop) {
  const rect = drop.getBoundingClientRect();

  if (drop.dataset.dropType === "powerup") {
    const inset = rect.width * 0.2;
    return {
      left: rect.left + inset,
      right: rect.right - inset,
      top: rect.top + inset,
      bottom: rect.bottom - inset,
    };
  }

  // Shrink drop hitbox to the visible droplet area inside the image.
  const leftInset = rect.width * 0.38;
  const rightInset = rect.width * 0.38;
  const topInset = rect.height * 0.30;
  const bottomInset = rect.height * 0.34;

  return {
    left: rect.left + leftInset,
    right: rect.right - rightInset,
    top: rect.top + topInset,
    bottom: rect.bottom - bottomInset,
  };
}

function isOverlapping(elementA, elementB) {
  const a = elementA.getBoundingClientRect();
  const b = elementB.getBoundingClientRect();

  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

function moveCan(clientX) {
  const containerRect = gameContainer.getBoundingClientRect();
  const canWidth = waterCan.offsetWidth;
  const minLeft = 0;
  const maxLeft = containerRect.width - canWidth;
  const desiredLeft = clientX - containerRect.left - canWidth / 2;
  const clampedLeft = Math.max(minLeft, Math.min(maxLeft, desiredLeft));

  waterCan.style.left = `${clampedLeft}px`;
  waterCan.style.transform = "none";
}

function setCanLeft(left) {
  const containerWidth = gameContainer.offsetWidth;
  const canWidth = waterCan.offsetWidth;
  const minLeft = 0;
  const maxLeft = containerWidth - canWidth;
  const clampedLeft = Math.max(minLeft, Math.min(maxLeft, left));

  waterCan.style.left = `${clampedLeft}px`;
  waterCan.style.transform = "none";
}

function getCanLeft() {
  const currentLeft = parseFloat(waterCan.style.left);
  if (!Number.isNaN(currentLeft)) return currentLeft;

  const containerWidth = gameContainer.offsetWidth;
  const canWidth = waterCan.offsetWidth;
  return (containerWidth - canWidth) / 2;
}

function centerCan() {
  const containerWidth = gameContainer.offsetWidth;
  const canWidth = waterCan.offsetWidth;
  setCanLeft((containerWidth - canWidth) / 2);
}

function endGame() {
  gameRunning = false;
  isDraggingCan = false;
  clearInterval(blueDropMaker);
  clearInterval(brownDropMaker);
  clearInterval(powerUpMaker);
  clearInterval(timerTicker);
  resetPowerUps();

  const isNewHighScore = score > 0 && score > highScore;

  if (isNewHighScore) {
    playNewHighScoreSound();
  } else {
    playGameOverSound();
  }

  if (isNewHighScore) {
    highScore = score;
  }

  finalScoreEl.textContent = score;
  highScoreEl.textContent = highScore;
  highScoreHudEl.textContent = highScore;

  if (isNewHighScore) {
    gameOverTitle.textContent = "New High Score!";
    newHighscoreBanner.classList.remove("hidden");
    launchConfetti();
  } else {
    gameOverTitle.textContent = "Try Again";
    newHighscoreBanner.classList.add("hidden");
    stopConfetti();
  }

  gameOverOverlay.classList.remove("hidden");
}

function launchConfetti() {
  confettiCanvas.width = gameContainer.offsetWidth;
  confettiCanvas.height = gameContainer.offsetHeight;
  confettiParticles = Array.from({ length: 120 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: Math.random() * confettiCanvas.height - confettiCanvas.height,
    r: Math.random() * 7 + 4,
    d: Math.random() * 80 + 20,
    color: ["#FFC907", "#2E9DF7", "#4FCB53", "#FF902A", "#F5402C", "#8BD1CB"][
      Math.floor(Math.random() * 6)
    ],
    tilt: Math.random() * 10 - 5,
    tiltSpeed: Math.random() * 0.1 + 0.05,
    speed: Math.random() * 2 + 1,
  }));

  if (confettiRaf) cancelAnimationFrame(confettiRaf);
  animateConfetti();
}

function animateConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  confettiParticles.forEach((p) => {
    p.tilt += p.tiltSpeed;
    p.y += p.speed;
    p.x += Math.sin(p.d / 20) * 1.5;

    confettiCtx.beginPath();
    confettiCtx.ellipse(p.x, p.y, p.r, p.r * 0.5, p.tilt, 0, Math.PI * 2);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fill();

    // Wrap back to top when it falls off screen.
    if (p.y > confettiCanvas.height) {
      p.y = -10;
      p.x = Math.random() * confettiCanvas.width;
    }
  });

  confettiRaf = requestAnimationFrame(animateConfetti);
}

function stopConfetti() {
  if (confettiRaf) {
    cancelAnimationFrame(confettiRaf);
    confettiRaf = null;
  }
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

waterCan.addEventListener("mousedown", (event) => {
  if (!gameRunning) return;
  isDraggingCan = true;
  waterCan.classList.add("dragging");
  moveCan(event.clientX);
});

window.addEventListener("mousemove", (event) => {
  if (!gameRunning || !isDraggingCan) return;
  moveCan(event.clientX);
});

window.addEventListener("mouseup", () => {
  isDraggingCan = false;
  waterCan.classList.remove("dragging");
});

document.addEventListener("keydown", (event) => {
  if (!gameRunning) return;

  const step = 30;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    setCanLeft(getCanLeft() - step);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    setCanLeft(getCanLeft() + step);
  }
});
