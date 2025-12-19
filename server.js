// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const players = {}; // socket.id -> { name, position }

// Middleware um JSON Body zu parsen
app.use(express.json());
app.use(express.static("public"));

// ------------------- Socket.IO -------------------
io.on("connection", socket => {
  console.log("🔗 User connected:", socket.id);

  socket.on("join", name => {
    players[socket.id] = { name, position: { x:0,y:0,z:0 } };
    console.log("➕ User joined:", socket.id);

    socket.broadcast.emit("user-joined", socket.id);

    Object.keys(players).forEach(id => {
      if(id !== socket.id) socket.emit("user-joined", id);
    });
  });

  socket.on("updatePos", pos => {
    if(players[socket.id]) players[socket.id].position = pos;
  });

  
  socket.on("signal", data => {
    // Daten weiterleiten an den angegebenen Peer
    io.to(data.to).emit("signal", { from: socket.id, signal: data.signal });
  });

  socket.on("disconnect", () => {
    console.log("❌ User left:", socket.id);
    delete players[socket.id];
    socket.broadcast.emit("user-left", socket.id);
  });
});

// ------------------- HTTP Endpoint für Roblox -------------------
// Roblox Server sendet Spielerpositionen per POST
app.post("/pos", (req, res) => {
  const { players: sentPlayers } = req.body; // erwartet { players: [ {id, name, position}, ... ] }
  if(!sentPlayers || !Array.isArray(sentPlayers)) return res.status(400).send("Missing players array");

  sentPlayers.forEach(p => {
    if(!p.id || !p.position || !p.name) return; // skip invalid
    players[p.id] = { name: p.name, position: p.position };
  });

  // Optional: Socket.IO Broadcast, falls Clients das live sehen sollen
  io.emit("players", players);

  res.send("Positions updated ✅");
});


// optional: alle 100ms alle Positionen an alle senden
setInterval(()=>{
  io.emit("players", players);
},100);

server.listen(3000, ()=>console.log("Server running on port 3000"));
