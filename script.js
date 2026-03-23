// Variables to control game state
let gameRunning = false; // Keeps track of whether game is active or not
let blueDropMaker; // Timer for blue drops
let brownDropMaker; // Timer for brown drops
let timerTicker; // Timer for elapsed game time
let score = 0;
let lives = 3;
let isDraggingCan = false;
let elapsedSeconds = 0;
let dropFallDuration = 4;
let brownDropInterval = 3000;
let highScore = 0;

const SPEED_UP_EVERY_SECONDS = 10; // How often to increase drop speed
const DROP_DURATION_STEP = 0.5;
const MIN_DROP_DURATION = 1.5;
const BROWN_INTERVAL_STEP = 300;  // ms shorter each speed-up
const MIN_BROWN_INTERVAL = 600;   // cap: brown drops never faster than this

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
const confettiCanvas = document.getElementById("confetti-canvas");
const confettiCtx = confettiCanvas.getContext("2d");
let confettiParticles = [];
let confettiRaf = null;

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

  score = 0;
  lives = 3;
  elapsedSeconds = 0;
  dropFallDuration = 4;
  brownDropInterval = 3000;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  timeEl.textContent = elapsedSeconds;
  gameRunning = true;
  startOverlay.classList.add("hidden");
  centerCan();
  createGoodDrop();

  // Blue drops spawn every second.
  blueDropMaker = setInterval(createGoodDrop, 1000);

  // Brown drops spawn at one-third the blue frequency.
  brownDropMaker = setInterval(createBadDrop, 3000);

  // Timer counts up from 0 and increases difficulty every 30 seconds.
  timerTicker = setInterval(() => {
    elapsedSeconds += 1;
    timeEl.textContent = elapsedSeconds;

    if (elapsedSeconds % SPEED_UP_EVERY_SECONDS === 0) {
      // Increase drop fall speed.
      if (dropFallDuration > MIN_DROP_DURATION) {
        dropFallDuration = Math.max(
          MIN_DROP_DURATION,
          dropFallDuration - DROP_DURATION_STEP
        );
      }

      // Increase brown drop frequency by restarting its interval shorter.
      if (brownDropInterval > MIN_BROWN_INTERVAL) {
        brownDropInterval = Math.max(
          MIN_BROWN_INTERVAL,
          brownDropInterval - BROWN_INTERVAL_STEP
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

function startDrop( drop ) {
  // Make drops different sizes for visual variety
  const initialSize = 300;
  const sizeMultiplier = Math.random() * 0.8 + 0.5;
  const size = initialSize * sizeMultiplier;
  drop.style.width = drop.style.height = `${size}px`;
  

  // Position the drop randomly across the game width
  // Subtract 60 pixels to keep drops fully inside the container
  const gameWidth = document.getElementById("game-container").offsetWidth;
  const xPosition = Math.random() * (gameWidth - 60);
  drop.style.left = xPosition + "px";

  // Make drops fall faster over time.
  drop.style.animationDuration = `${dropFallDuration}s`;

  // Add the new drop to the game screen
  gameContainer.appendChild(drop);

  let handled = false;

  const handleCatch = () => {
    if (handled || !drop.isConnected || !isDropTouchingCan(drop)) return;

    handled = true;
    if (drop.dataset.dropType === "blue") {
      score += 10;
      scoreEl.textContent = score;
    } else if (drop.dataset.dropType === "brown") {
      lives -= 1;
      livesEl.textContent = lives;

      if (lives <= 0) {
        endGame();
      }
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

  // Tune the hitbox to the visible yellow body of the can.
  const leftInset = rect.width * 0.22;
  const rightInset = rect.width * 0.22;
  const topInset = rect.height * 0.38;
  const bottomInset = rect.height * 0.08;

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

  // Shrink drop hitbox to the visible droplet area inside the image.
  const leftInset = rect.width * 0.30;
  const rightInset = rect.width * 0.30;
  const topInset = rect.height * 0.22;
  const bottomInset = rect.height * 0.28;

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
  clearInterval(timerTicker);

  const isNewHighScore = score > 0 && score > highScore;
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
