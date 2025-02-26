const sqlite3 = require('sqlite3').verbose();
    const crypto = require('crypto');

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
        password TEXT NOT NULL
      )`);
    });

    // Function to hash password (INSECURE - FOR DEMO ONLY)
    function hashPassword(password) {
      //DO NOT USE THIS IN PRODUCTION
      return crypto.createHash('sha256').update(password).digest('hex');
    }

    // Function to register a new user
    function registerUser(username, password, callback) {
      const hashedPassword = hashPassword(password);

      db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function(err) {
        if (err) {
          console.error(err.message);
          return callback(err);
        }
        console.log(`User ${username} registered with ID: ${this.lastID}`);
        callback(null);
      });
    }

    // Function to verify user credentials
    function verifyUser(username, password, callback) {
      const hashedPassword = hashPassword(password);

      db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, hashedPassword], (err, row) => {
        if (err) {
          console.error(err.message);
          return callback(err);
        }
        if (row) {
          console.log(`User ${username} verified.`);
          callback(null, row);
        } else {
          console.log(`Invalid credentials for user ${username}.`);
          callback(null, null);
        }
      });
    }

    module.exports = {
      registerUser,
      verifyUser
    };
