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
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const HEARING_RADIUS = 50;

// Spieler speichern: userId -> {name, x, z, socketId}
let players = {};

// ------------------ Roblox /pos Endpoint ------------------
app.post("/pos", (req, res) => {
  const data = req.body;
  if (!data.players) return res.status(400).send("No players sent");

  data.players.forEach(p => {
    players[p.id] = {
      name: p.name,
      x: p.position.x,
      z: p.position.z,
      socketId: null // keine SocketId für reine HTTP Daten
    };
  });

  res.send({ status: "ok" });
});

// ------------------ Socket.IO ------------------
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Spieler registrieren (Roblox UserId)
  socket.on("register", ({ userId, name, position }) => {
    socket.userId = userId;
    players[userId] = {
      name,
      x: position.x,
      z: position.z,
      socketId: socket.id
    };
    io.emit("updatePlayers", players);
  });

  // Position aktualisieren
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

      const volume = 1 - (dist / HEARING_RADIUS);
      const targetSocket = io.sockets.sockets.get(p.socketId);
      if (targetSocket) {
        targetSocket.emit("voice", {
          audio,
          fromX: sender.x,
          fromZ: sender.z,
          volume
        });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    // Optional: Spieler löschen, wenn SocketId existierte
    for (let id in players) {
      if (players[id].socketId === socket.id) delete players[id].socketId;
    }
    io.emit("updatePlayers", players);
  });
});

// ------------------ Server starten ------------------
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🌐 Server läuft auf http://localhost:${PORT}`);
});
