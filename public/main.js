const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener("resize",()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight});

const socket = io();
const HEARING_RADIUS = 50;
let players = {};
let localPlayer = null;
let micEnabled = false;

// Player auswählen
document.getElementById("startBtn").addEventListener("click", ()=>{
  const id=document.getElementById("playerId").value;
  const name=document.getElementById("playerName").value||"Ich";
  if(!id)return alert("Bitte Roblox UserId eingeben!");
  localPlayer={userId:id,name:name,x:0,z:0};
  socket.emit("register",{userId:id,name:name,position:{x:0,z:0}});
  document.getElementById("selectPlayer").style.display="none";
  startProximity();
});

// Mikrofon aktivieren/deaktivieren
document.getElementById("toggleMic").addEventListener("click",()=>{
  micEnabled = !micEnabled;
  if(micEnabled) startMic();
});

// Canvas Loop
function startProximity(){
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Eigener Spieler
    ctx.fillStyle="#0ff";
    ctx.beginPath();
    ctx.arc(canvas.width/2,canvas.height/2,15,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle="#fff";
    ctx.fillText(localPlayer.name,canvas.width/2-10,canvas.height/2-20);

    // Andere Spieler
    for(let id in players){
      if(id===localPlayer.userId) continue;
      const p=players[id];
      const dx=p.x-localPlayer.x;
      const dz=p.z-localPlayer.z;
      const dist=Math.sqrt(dx*dx+dz*dz);
      if(dist>HEARING_RADIUS) continue;
      const screenX=canvas.width/2+dx*5;
      const screenY=canvas.height/2+dz*5;
      ctx.beginPath();
      ctx.arc(screenX,screenY,12,0,Math.PI*2);
      ctx.fillStyle="#f00";
      ctx.fill();
      ctx.fillStyle="#fff";
      ctx.fillText(p.name,screenX-10,screenY-15);
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// Position Updates senden (z.B. aus Roblox)
setInterval(()=>{
  if(!localPlayer) return;
  // localPlayer.x / z sollten hier echte Werte aus Roblox sein
  socket.emit("updatePosition",{position:{x:localPlayer.x,z:localPlayer.z}});
},100);

// Voice empfangen
socket.on("voice",({audio,fromX,fromZ,volume})=>{
  if(!localPlayer) return;
  const dx=fromX-localPlayer.x;
  const dz=fromZ-localPlayer.z;
  const dist=Math.sqrt(dx*dx+dz*dz);
  if(dist>HEARING_RADIUS) return;
  const a=new Audio("data:audio/webm;base64,"+audio);
  a.volume=volume;
  a.play();
});

// Spielerlisten-Update
socket.on("updatePlayers",data=>{players=data});

// Mikrofon aufnehmen
function startMic(){
  navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{
    const recorder=new MediaRecorder(stream,{mimeType:"audio/webm;codecs=opus"});
    recorder.ondataavailable=e=>{
      const reader=new FileReader();
      reader.onload=()=>{ const base64=reader.result.split(",")[1]; socket.emit("voice",{audio:base64}); };
      reader.readAsDataURL(e.data);
    };
    recorder.start(200);
  });
}
