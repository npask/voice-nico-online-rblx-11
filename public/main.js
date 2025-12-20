// ================== CANVAS ==================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// ================== SOCKET ==================
const socket = io();

// ================== CONFIG ==================
const HEARING_RADIUS = 50;
let SCALE = 0.015; // gut für Minecraft Koordinaten 🧱

// ================== STATE ==================
let players = {};
let localPlayer = null;
let localUserId = null;
let micEnabled = false;

// ================== UI ==================
const menu = document.getElementById("menu");
const playerSelect = document.getElementById("playerSelect");
const startBtn = document.getElementById("startBtn");
const micBtn = document.getElementById("toggleMic");

// ================== PLAYER MENU ==================
function updatePlayerMenu() {
  playerSelect.innerHTML = "";
  Object.keys(players).forEach(id => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `${players[id].name} (${id})`;
    playerSelect.appendChild(opt);
  });
}

// ================== SOCKET EVENTS ==================
socket.on("updatePlayers", data => {
  players = data;
  updatePlayerMenu();

  if (localUserId && players[localUserId]) {
    localPlayer = players[localUserId];
  }
});

// ================== START ==================
startBtn.addEventListener("click", () => {
  localUserId = playerSelect.value;
  if (!localUserId) return alert("Spieler auswählen 👀");

  localPlayer = players[localUserId];
  socket.emit("identify", localUserId);

  menu.style.display = "none";
  startRenderLoop();
});

// ================== RENDER LOOP ==================
function startRenderLoop() {
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!localPlayer) return requestAnimationFrame(draw);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // ===== YOU =====
    ctx.fillStyle = "#00ffff";
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.fillText(localPlayer.name + " (YOU)", cx - 20, cy - 20);

    // ===== OTHERS =====
    for (let id in players) {
      if (id === localUserId) continue;

      const p = players[id];
      const dx = p.x - localPlayer.x;
      const dz = p.z - localPlayer.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > HEARING_RADIUS) continue;

      const x = cx + dx * SCALE;
      const y = cy + dz * SCALE;

      ctx.fillStyle = "#ff5555";
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.fillText(p.name, x - 10, y - 14);
    }

    requestAnimationFrame(draw);
  }
  draw();
}

// ================== MIC ==================
micBtn.addEventListener("click", () => {
  micEnabled = !micEnabled;
  micBtn.textContent = micEnabled ? "🎤 Mic ON" : "🎤 Mic OFF";
  if (micEnabled) startMic();
});

function startMic() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus"
    });

    recorder.ondataavailable = e => {
      if (!micEnabled) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        socket.emit("voice", { audio: base64 });
      };
      reader.readAsDataURL(e.data);
    };

    recorder.start(200); // 200ms chunks
  }).catch(err => {
    console.error("Mic error:", err);
  });
}

// ================== VOICE RECEIVE ==================
socket.on("voice", ({ audio, volume }) => {
  playVoice(audio, volume);
});

function playVoice(base64, volume) {
  const audio = new Audio();
  audio.src = "data:audio/webm;base64," + base64;
  audio.volume = volume;
  audio.play().catch(() => {});
}

// ================== ZOOM (OPTIONAL, NICE 😎) ==================
window.addEventListener("wheel", e => {
  SCALE += e.deltaY * -0.00001;
  SCALE = Math.max(0.005, Math.min(0.05, SCALE));
});
