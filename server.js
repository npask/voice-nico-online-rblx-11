const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

const players = {}; // id -> {name, position}

// --------------------
// Socket.IO für Voice + Ping
// --------------------
io.on("connection", socket=>{
    console.log("🔗 User connected:", socket.id);

socket.on("join", name=>{
    // Nur existierende Spieler updaten
    if(players[socket.id]){
        players[socket.id].name = name; // Name aktualisieren
        socket.broadcast.emit("user-joined", socket.id);
    } else {
        logDebug("⚠️ Spieler nicht bekannt vom Roblox-Server: "+socket.id);
    }
});


    socket.on("voice", (data)=>{
        // Broadcast an alle anderen Spieler
        socket.broadcast.emit("voice", data, socket.id);
    });

    socket.on("ping", ()=>socket.emit("pong"));

    socket.on("disconnect", ()=>{
        delete players[socket.id];
        socket.broadcast.emit("user-left", socket.id);
    });
});

// --------------------
// Roblox POST /pos
// --------------------
app.post("/pos", (req,res)=>{
    const { players: sentPlayers } = req.body; // [{id,name,position}]
    if(!sentPlayers || !Array.isArray(sentPlayers)) return res.status(400).send("Missing players array");

    sentPlayers.forEach(p=>{
        if(!p.id || !p.position || !p.name) return;
        // Nur existierende Spieler updaten
        if(players[p.id]){
            players[p.id].position = p.position;
        }
    });

    // Broadcast an alle Clients
    io.emit("players", players);
    res.send("Positions updated ✅");
});

server.listen(3000, ()=>console.log("Server running on port 3000"));
