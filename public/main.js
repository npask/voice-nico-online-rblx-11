const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener("resize",()=>{canvas.width=window.innerWidth; canvas.height=window.innerHeight});

const socket = io();
const HEARING_RADIUS = 50;
let players = {};
let localPlayer = null;
let micEnabled = false;

// Menü
const menu = document.getElementById("menu");
const playerSelect = document.getElementById("playerSelect");
const startBtn = document.getElementById("startBtn");

// Menü aktualisieren
function updatePlayerMenu(){
  playerSelect.innerHTML = "";
  Object.keys(players).forEach(id=>{
    const option = document.createElement("option");
    option.value = id;
    option.text = players[id].name+" ("+id+")";
    playerSelect.add(option);
  });
}

// Socket UpdatePlayers
socket.on("updatePlayers",(data)=>{
  players=data;
  updatePlayerMenu();
});

// Spieler auswählen
startBtn.addEventListener("click",()=>{
  const userId = playerSelect.value;
  if(!userId) return alert("Bitte Spieler auswählen!");
  localPlayer = players[userId];
  socket.emit("identify", userId);
  menu.style.display="none";
  startProximity();
});

// Canvas Loop
function startProximity(){
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!localPlayer) return;

    const centerX = canvas.width/2;
    const centerY = canvas.height/2;
    const SCALE = 0.2;

    // Eigener Spieler
    ctx.fillStyle="#0ff";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle="#fff";
    ctx.fillText(localPlayer.name, centerX-10, centerY-20);

    // Andere Spieler
    for(let id in players){
      if(id===localPlayer.userId) continue;
      const p = players[id];
      const dx = p.x - localPlayer.x;
      const dz = p.z - localPlayer.z;
      const dist = Math.sqrt(dx*dx+dz*dz);
      if(dist>HEARING_RADIUS) continue;

      const screenX = centerX + dx*SCALE;
      const screenY = centerY + dz*SCALE;

      ctx.beginPath();
      ctx.arc(screenX, screenY, 12,0,Math.PI*2);
      ctx.fillStyle="#f00";
      ctx.fill();
      ctx.fillStyle="#fff";
      ctx.fillText(p.name,screenX-10,screenY-15);
    }

    requestAnimationFrame(draw);
  }
  draw();
}

// Mikrofon
document.getElementById("toggleMic").addEventListener("click",()=>{
  micEnabled=!micEnabled;
  if(micEnabled) startMic();
});

function startMic(){
  navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{
    const recorder = new MediaRecorder(stream,{mimeType:"audio/webm;codecs=opus"});
    recorder.ondataavailable=e=>{
      const reader=new FileReader();
      reader.onload=()=>{ const base64=reader.result.split(",")[1]; socket.emit("voice",{audio:base64}); };
      reader.readAsDataURL(e.data);
    };
    recorder.start(200);
  });
}

// Voice empfangen
function playAudio(base64,volume=1){
  const audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  fetch("data:audio/webm;base64,"+base64)
    .then(res=>res.arrayBuffer())
    .then(buf=>audioCtx.decodeAudioData(buf))
    .then(decoded=>{
      const source=audioCtx.createBufferSource();
      source.buffer=decoded;
      const gainNode=audioCtx.createGain();
      gainNode.gain.value=volume;
      source.connect(gainNode).connect(audioCtx.destination);
      source.start();
    }).catch(e=>console.error(e));
}

socket.on("voice",({audio,fromX,fromZ,volume})=>{
  if(!localPlayer) return;
  const dx=fromX-localPlayer.x;
  const dz=fromZ-localPlayer.z;
  const dist=Math.sqrt(dx*dx+dz*dz);
  if(dist>HEARING_RADIUS) return;
  playAudio(audio,volume);
});
