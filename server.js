// ================================
// Node.js + Socket.IO Server
// ================================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let players = {}; // speichert aktuelle Spieler-Positionen {id: {x,y,z,name}}

app.post("/pos", (req, res) => {
  const data = req.body;
  if (!data.players) return res.status(400).send("No players sent");
  
  data.players.forEach(p => {
    players[p.id] = {
      name: p.name,
      position: p.position
    };
  });
  
  res.send({ status: "ok" });
});

// ================================
// Socket.IO für 2D Proximity Audio
// ================================
io.on("connection", (socket) => {
  console.log(`🎧 User connected: ${socket.id}`);

  // Client sendet eigene Position
  socket.on("updatePosition", (data) => {
    socket.position = data.position; // {x, y, z}
  });

socket.on("voice", (data) => {
  const senderPos = socket.position || {x:0, z:0};
  for (let [id, s] of io.sockets.sockets) {
    if (id === socket.id) continue;
    if (!s.position) continue;

    const dx = s.position.x - senderPos.x;
    const dz = s.position.z - senderPos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    if(dist > 50) continue; // nicht hören, außerhalb Radius

    let volume = 1 - (dist / 50);
    if(volume < 0) volume = 0;

    s.emit("voice", {
      audio: data.audio,
      fromX: senderPos.x,
      fromZ: senderPos.z,
      volume
    });
  }
});

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log("🌐 Server läuft auf http://localhost:3000");
});
