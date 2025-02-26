const express = require("express");
    const path = require("path");
    const http = require("http");
    const socketIo = require("socket.io");
    const sqlite3 = require('sqlite3').verbose();
    const crypto = require('crypto');
    const bodyParser = require('body-parser');

    // Initialize Express app
    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);

    app.use(bodyParser.json()); // Middleware to parse JSON bodies
    app.use(express.static(path.join(__dirname, "public")));

    // Database setup
    const db = new sqlite3.Database('users.db', (err) => {
      if (err) {
        console.error(err.message);
      }
      console.log('Connected to the users database.');
    });

    // Create users table if it doesn't exist
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        salt TEXT NOT NULL
      )`);
    });

    // Function to hash password (INSECURE - FOR DEMO ONLY)
    function hashPassword(password, salt) {
      const hash = crypto.createHash('sha256');
      hash.update(salt + password);
      return hash.digest('hex');
    }

    // API endpoint to register a new user
    app.post('/register', (req, res) => {
      const {
        username,
        password
      } = req.body;

      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = hashPassword(password, salt);

      db.run(`INSERT INTO users (username, password, salt) VALUES (?, ?, ?)`, [username, hashedPassword, salt], function(err) {
        if (err) {
          console.error(err.message);
          return res.status(500).send({
            error: err.message
          });
        }
        console.log(`User ${username} registered with ID: ${this.lastID}`);
        res.send({
          message: 'User registered successfully!'
        });
      });
    });

    // API endpoint to verify user credentials
    app.post('/login', (req, res) => {
      const {
        username,
        password
      } = req.body;

      db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
        if (err) {
          console.error(err.message);
          return res.status(500).send({
            error: err.message
          });
        }

        if (!row) {
          return res.status(401).send({
            message: 'Invalid credentials.'
          });
        }

        const hashedPassword = hashPassword(password, row.salt);

        if (hashedPassword === row.password) {
          console.log(`User ${username} verified.`);
          res.send({
            message: 'Login successful!'
          });
        } else {
          console.log(`Invalid credentials for user ${username}.`);
          res.status(401).send({
            message: 'Invalid credentials.'
          });
        }
      });
    });

    // Socket.IO logic
    io.on("connection", (socket) => {
      console.log("A client connected:", socket.id);

      // Handle sender joining a room
      socket.on("sender-join", (data) => {
        console.log("Sender joined with UID:", data.uid);
        socket.join(data.uid);
      });

      // Handle receiver joining a room
      socket.on("receiver-join", (data) => {
        console.log("Receiver joined with UID:", data.uid);
        socket.join(data.uid);
        socket.to(data.sender_uid).emit("init", data.uid);
      });

      // Handle receiving file metadata
      socket.on("file-meta", (data) => {
        console.log("Received file metadata:", data.metadata);
        socket.to(data.uid).emit("fs-meta", data.metadata);
      });

      // Handle file sharing start signal
      socket.on("fs-start", (data) => {
        console.log("File sharing started for UID:", data.uid);
        socket.to(data.uid).emit("fs-share", {});
      });

      // Handle receiving file data (raw buffer)
      socket.on("file-raw", (data) => {
        console.log("Received file buffer, sharing...");
        socket.to(data.uid).emit("fs-share", data.buffer);
      });

      // Handle client disconnect
      socket.on("disconnect", () => {
        console.log("A client disconnected:", socket.id);
      });
    });

    // Set the port dynamically or use 5000 as a fallback
    const PORT = process.env.PORT || 5000;

    // Start the server and handle errors like "EADDRINUSE"
    server.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    }).on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Please use a different port.`);
        process.exit(1);
      } else {
        console.error("Server error:", err);
        process.exit(1);
      }
    });
