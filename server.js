const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const http = require('http');
const { parse } = require('cookie');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const DB_URL = process.env.DB_URL;

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

app.use(bodyParser.json());
app.use(express.static('public'));

async function query(sql, params) {
  const res = await pool.query(sql, params);
  return res;
}

async function auth(req, res, next) {
  try {
    const cookieHeader = req.headers.cookie || '';
    const token = parse(cookieHeader).token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const data = jwt.verify(token, JWT_SECRET);
    const user = await query("SELECT id, name, email FROM users WHERE id=$1", [data.id]);
    if (user.rows.length === 0) return res.status(401).json({ error: 'Unauthorized' });

    req.user = user.rows[0];
    next();
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const check = await query("SELECT id FROM users WHERE email=$1", [email]);
    if (check.rows.length) return res.json({ error: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);
    await query("INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3)", [name, email, hash]);

    res.json({ success: true });
  } catch (e) {
    console.log(e);
    res.json({ error: "Error" });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const u = await query("SELECT * FROM users WHERE email=$1", [email]);
    if (!u.rows.length) return res.json({ error: "Invalid" });

    const ok = await bcrypt.compare(password, u.rows[0].password_hash);
    if (!ok) return res.json({ error: "Invalid" });

    const token = jwt.sign({ id: u.rows[0].id }, JWT_SECRET, { expiresIn: "7d" });
    res.setHeader("Set-Cookie", `token=${token}; HttpOnly; Path=/; Max-Age=${7*86400}`);
    res.json({ success: true });
  } catch (e) {
    console.log(e);
    res.json({ error: "Error" });
  }
});

app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", "token=; HttpOnly; Path=/; Max-Age=0");
  res.json({ success: true });
});

app.get("/api/me", auth, (req,res)=>{
  res.json({ user:req.user });
});

app.get("/api/messages", auth, async (req,res)=>{
  const m = await query(`
    SELECT m.id, m.message, m.created_at, u.id AS user_id, u.name AS username
    FROM messages m
    JOIN users u ON m.user_id=u.id
    ORDER BY m.id DESC LIMIT 100
  `);
  res.json({ messages: m.rows.reverse() });
});

io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || "";
    const token = parse(cookieHeader).token;
    if (!token) return next(new Error("Unauthorized"));

    const data = jwt.verify(token, JWT_SECRET);
    const u = await query("SELECT id,name FROM users WHERE id=$1", [data.id]);
    if (!u.rows.length) return next(new Error("Unauthorized"));

    socket.user = u.rows[0];
    next();
  } catch (e) {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket)=>{
  socket.on("sendMessage", async msg=>{
    if (!msg) return;
    const now = new Date().toISOString();
    await query("INSERT INTO messages (user_id,message,created_at) VALUES ($1,$2,$3)", [socket.user.id,msg,now]);
    io.emit("message",{ user_id:socket.user.id, username:socket.user.name, message:msg, created_at:now });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=> console.log("Running on "+PORT));
