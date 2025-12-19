const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const players = {}; // socket.id -> { name, position }

// Middleware
app.use(express.json());
app.use(express.static("public"));

// ------------------- Socket.IO -------------------
io.on("connection", socket => {
  console.log("🔗 User connected:", socket.id);

  // Spieler join
  socket.on("join", name => {
    // Prüfen ob der Name schon existiert
    const existingId = Object.keys(players).find(id => players[id].name === name);
    if(existingId){
      console.log(`♻️ Name existiert, Verbindung ersetzt: ${name}`);
      delete players[existingId]; // alten Spieler entfernen
      io.to(existingId).emit("force-disconnect"); // optional: alten Socket kicken
    }

    players[socket.id] = { name, position: { x:0, y:0, z:0 } };
    console.log(`➕ User joined: ${name} (${socket.id})`);

    // allen anderen mitteilen
    socket.broadcast.emit("user-joined", socket.id);

    // neuen Spieler auch alle vorhandenen Spieler senden
    Object.keys(players).forEach(id => {
      if(id !== socket.id) socket.emit("user-joined", id);
    });
  });

  // Position Update
  socket.on("updatePos", pos => {
    if(players[socket.id]) players[socket.id].position = pos;
  });

  // RTC Signaling
  socket.on("signal", data => {
    if(data.to) io.to(data.to).emit("signal", { from: socket.id, signal: data.signal });
  });

  // Disconnect
  socket.on("disconnect", () => {
    if(players[socket.id]){
      console.log(`❌ User left: ${players[socket.id].name} (${socket.id})`);
      delete players[socket.id];
      socket.broadcast.emit("user-left", socket.id);
    }
  });
});

// ------------------- Roblox /pos Endpoint -------------------
app.post("/pos", (req, res) => {
  const { players: sentPlayers } = req.body;
  if(!Array.isArray(sentPlayers)) return res.status(400).send("Missing players array");

  sentPlayers.forEach(p => {
    if(!p.id || !p.position || !p.name) return;
    players[p.id] = { name: p.name, position: p.position };
  });

  io.emit("players", players);
  res.send("Positions updated ✅");
});

// Positions-Broadcast an alle alle 100ms
setInterval(()=> io.emit("players", players), 100);

server.listen(3000, ()=>console.log("Server running on port 3000"));
