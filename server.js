const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server);

const players = {}; // socketId -> { name, position }

/* =========================
   HTTP: Roblox Position API
   ========================= */
app.post("/pos", (req, res) => {
  const { id, x, y, z } = req.body;
  if (!players[id]) return res.sendStatus(404);

  players[id].position = { x, y, z };
  res.sendStatus(200);
});

/* =========================
   WebSocket: Signaling
   ========================= */
io.on("connection", socket => {
  console.log("Connected:", socket.id);

  socket.on("join", name => {
    players[socket.id] = {
      name,
      position: { x: 0, y: 0, z: 0 }
    };

    socket.broadcast.emit("user-joined", socket.id);
  });

  socket.on("signal", data => {
    io.to(data.to).emit("signal", {
      from: socket.id,
      signal: data.signal
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    socket.broadcast.emit("user-left", socket.id);
  });
});

/* =========================
   Broadcast Positions
   ========================= */
setInterval(() => {
  io.emit("players", players);
}, 1000);

server.listen(3000, () =>
  console.log("🟢 Server running on http://localhost:3000")
);
