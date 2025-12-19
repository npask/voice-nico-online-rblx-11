const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server);

const players = {}; 
// playerId -> { name?, position }

app.use(express.static("public"));

app.post("/positions", (req, res) => {
  const batch = req.body; // { playerId: {x,y,z}, ... }

  for (const id in batch) {
    if (!players[id]) {
      players[id] = { position: batch[id] };
    } else {
      players[id].position = batch[id];
    }
  }

  res.sendStatus(200);
});

io.on("connection", socket => {
  socket.on("join", name => {
    players[socket.id] = players[socket.id] || {
      name,
      position: { x: 0, y: 0, z: 0 }
    };
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

// 🔁 EIN Broadcast pro Sekunde
setInterval(() => {
  io.emit("players", players);
}, 1000);

server.listen(3000, () =>
  console.log("🟢 Server läuft auf http://localhost:3000")
);
