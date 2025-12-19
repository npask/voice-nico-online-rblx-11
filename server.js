const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const HEARING_RADIUS = 50; // max distance für Voice
let players = {}; // userId -> {name, x, z, socketId}

// ---------------- Roblox /pos ----------------
app.post("/pos", (req, res) => {
  const data = req.body;
  if (!data.players) return res.status(400).send("No players sent");

  data.players.forEach(p => {
    // Spieler nur hinzufügen, wenn noch nicht vorhanden
    if (!players[p.id]) {
      players[p.id] = {
        name: p.name,
        x: p.position.x,
        z: p.position.z,
        socketId: null // SocketId kommt später über Socket.IO
      };
    } else {
      // Nur Position aktualisieren
      players[p.id].x = p.position.x;
      players[p.id].z = p.position.z;
    }
  });

  // Update an alle verbundenen Clients senden
  io.emit("updatePlayers", players);

  res.send({ status: "ok" });
});

// ---------------- Socket.IO ----------------
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Wenn Client sich verbindet, suchen wir seinen User via `/pos` bereits gespeicherte Daten
  socket.on("identify", (userId) => {
    if (players[userId]) {
      players[userId].socketId = socket.id; // SocketId setzen
      socket.userId = userId;
      socket.emit("init", { player: players[userId], allPlayers: players });
    } else {console.log("notfound")}
  });

  // Position-Updates via Socket.IO
  socket.on("updatePosition", ({ position }) => {
    if (!socket.userId) return;
    players[socket.userId].x = position.x;
    players[socket.userId].z = position.z;
    io.emit("updatePlayers", players);
  });

  // Voice Event
  socket.on("voice", ({ audio }) => {
    if (!socket.userId) return;
    const sender = players[socket.userId];
    if (!sender) return;

    for (let id in players) {
      if (id === socket.userId) continue;
      const p = players[id];
      if (!p.socketId) continue;

      const dx = p.x - sender.x;
      const dz = p.z - sender.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist > HEARING_RADIUS) continue;

      const volume = 1 - dist / HEARING_RADIUS;
      const targetSocket = io.sockets.sockets.get(p.socketId);
      if(targetSocket){
        targetSocket.emit("voice", { audio, fromX: sender.x, fromZ: sender.z, volume });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    for (let id in players) {
      if (players[id].socketId === socket.id) players[id].socketId = null;
    }
    io.emit("updatePlayers", players);
  });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🌐 Server läuft auf Port ${PORT}`));
