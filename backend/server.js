const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'todos.db');
let db;

async function initDB() {
  const SQL = await initSqlJs();

  // 기존 DB 파일이 있으면 로드
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      completed_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 기존 DB 마이그레이션
  const addColumnSafe = (col, type, def) => {
    try { db.run(`ALTER TABLE todos ADD COLUMN ${col} ${type} DEFAULT ${def}`); } catch(e) {}
  };
  addColumnSafe('position', 'INTEGER', '0');
  addColumnSafe('completed_at', 'DATETIME', 'NULL');

  saveDB();
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// 결과를 객체 배열로 변환하는 헬퍼
function rowsToObjects(results) {
  if (results.length === 0) return [];
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

// 오늘 할 일: 미완료 전체 + 오늘 완료한 것
app.get('/api/todos', (req, res) => {
  const results = db.exec(`
    SELECT * FROM todos
    WHERE completed = 0
       OR (completed = 1 AND date(completed_at) = date('now'))
    ORDER BY position ASC, created_at DESC
  `);
  res.json(rowsToObjects(results));
});

// 완료됨 탭: 오늘 이전에 완료된 항목
app.get('/api/todos/done', (req, res) => {
  const results = db.exec(`
    SELECT * FROM todos
    WHERE completed = 1 AND date(completed_at) < date('now')
    ORDER BY completed_at DESC
  `);
  res.json(rowsToObjects(results));
});

// 추가
app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '할 일을 입력해주세요' });
  // 새 항목은 맨 아래에 추가
  const maxPos = db.exec('SELECT COALESCE(MAX(position), 0) as mp FROM todos');
  const nextPos = maxPos.length > 0 ? maxPos[0].values[0][0] + 1 : 0;
  db.run('INSERT INTO todos (text, position) VALUES (?, ?)', [text.trim(), nextPos]);
  saveDB();
  const result = db.exec('SELECT * FROM todos ORDER BY id DESC LIMIT 1');
  const columns = result[0].columns;
  const todo = {};
  columns.forEach((col, i) => todo[col] = result[0].values[0][i]);
  res.status(201).json(todo);
});

// 완료 토글
app.patch('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE todos SET
    completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END,
    completed_at = CASE WHEN completed = 0 THEN datetime('now') ELSE NULL END
    WHERE id = ?`, [Number(id)]);
  saveDB();
  const result = db.exec('SELECT * FROM todos WHERE id = ?', [Number(id)]);
  if (result.length === 0) return res.status(404).json({ error: '찾을 수 없습니다' });
  const columns = result[0].columns;
  const todo = {};
  columns.forEach((col, i) => todo[col] = result[0].values[0][i]);
  res.json(todo);
});

// 삭제
app.delete('/api/todos/:id', (req, res) => {
  const check = db.exec('SELECT * FROM todos WHERE id = ?', [Number(req.params.id)]);
  if (check.length === 0) return res.status(404).json({ error: '찾을 수 없습니다' });
  db.run('DELETE FROM todos WHERE id = ?', [Number(req.params.id)]);
  saveDB();
  res.json({ success: true });
});

// 순서 변경 (드래그앤드롭)
app.put('/api/todos/reorder', (req, res) => {
  const { ids } = req.body; // [3, 1, 5, 2] 형태의 id 배열
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids 배열이 필요합니다' });
  ids.forEach((id, index) => {
    db.run('UPDATE todos SET position = ? WHERE id = ?', [index, Number(id)]);
  });
  saveDB();
  res.json({ success: true });
});

initDB().then(() => {
  app.listen(3001, () => {
    console.log('🚀 백엔드 서버 실행 중: http://localhost:3001');
  });
});
