import { useState, useEffect, useRef } from 'react'
import './App.css'

const API = 'http://localhost:3001/api/todos'

function App() {
  const [todos, setTodos] = useState([])
  const [input, setInput] = useState('')
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const dragNode = useRef(null)

  // 전체 조회
  const fetchTodos = async () => {
    const res = await fetch(API)
    setTodos(await res.json())
  }

  useEffect(() => { fetchTodos() }, [])

  // 추가
  const addTodo = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input })
    })
    setInput('')
    fetchTodos()
  }

  // 완료 토글
  const toggleTodo = async (id) => {
    await fetch(`${API}/${id}`, { method: 'PATCH' })
    fetchTodos()
  }

  // 삭제
  const deleteTodo = async (id) => {
    await fetch(`${API}/${id}`, { method: 'DELETE' })
    fetchTodos()
  }

  // 드래그앤드롭
  const handleDragStart = (e, index) => {
    setDragIndex(index)
    dragNode.current = e.target.closest('li')
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => dragNode.current?.classList.add('dragging'), 0)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (dragIndex === index) return
    setOverIndex(index)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const newTodos = [...todos]
    const [moved] = newTodos.splice(dragIndex, 1)
    newTodos.splice(overIndex, 0, moved)
    setTodos(newTodos)
    setDragIndex(null)
    setOverIndex(null)
    dragNode.current?.classList.remove('dragging')

    // 서버에 새 순서 저장
    await fetch(`${API}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newTodos.map(t => t.id) })
    })
  }

  const handleDragEnd = () => {
    dragNode.current?.classList.remove('dragging')
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="app">
      <h1>📝 할 일 관리</h1>

      <form onSubmit={addTodo} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="할 일을 입력하세요..."
          autoFocus
        />
        <button type="submit">추가</button>
      </form>

      <ul className="todo-list">
        {todos.map((todo, index) => (
          <li
            key={todo.id}
            className={`${todo.completed ? 'completed' : ''} ${overIndex === index ? 'drop-target' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          >
            <span className="drag-handle">☰</span>
            <span className="todo-text" onClick={() => toggleTodo(todo.id)}>
              {todo.completed ? '✅' : '⬜'} {todo.text}
            </span>
            <button className="delete-btn" onClick={() => deleteTodo(todo.id)}>
              🗑️
            </button>
          </li>
        ))}
      </ul>

      {todos.length === 0 && <p className="empty">할 일이 없습니다. 추가해보세요!</p>}

      <p className="count">
        총 {todos.length}개 | 완료 {todos.filter(t => t.completed).length}개
      </p>
    </div>
  )
}

export default App
