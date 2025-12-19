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

  // Client sendet Audio Chunk
  socket.on("voice", (data) => {
    // Broadcast an alle anderen mit Lautstärke basierend auf Distance
    for (let [id, s] of io.sockets.sockets) {
      if (id === socket.id) continue;
      if (!s.position) continue;

      const dx = s.position.x - socket.position.x;
      const dz = s.position.z - socket.position.z;
      const dist = Math.sqrt(dx*dx + dz*dz);

      let volume = 1 - (dist / 50); // 50 = Max Distanz, danach stumm
      if (volume <= 0) volume = 0;

      s.emit("voice", { audio: data.audio, volume });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log("🌐 Server läuft auf http://localhost:3000");
});
