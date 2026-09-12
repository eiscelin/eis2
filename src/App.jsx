import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

function App() {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(5)
  const [seconds, setSeconds] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const intervalRef = useRef(null)

  const totalInputSeconds = hours * 3600 + minutes * 60 + seconds

  const handleStart = () => {
    if (timeLeft === 0 && totalInputSeconds > 0) {
      setTimeLeft(totalInputSeconds)
    }
    setIsRunning(true)
    setIsFinished(false)
  }

  const handlePause = () => {
    setIsRunning(false)
  }

  const handleReset = () => {
    setIsRunning(false)
    setIsFinished(false)
    setTimeLeft(0)
  }

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current)
            setIsRunning(false)
            setIsFinished(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [isRunning, timeLeft === 0])

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const displayTime = timeLeft > 0 ? timeLeft : totalInputSeconds
  const progress = totalInputSeconds > 0 ? (timeLeft / totalInputSeconds) * 100 : 0

  const clamp = (val, max) => Math.max(0, Math.min(max, isNaN(val) ? 0 : val))

  return (
    <div className="app">
      <div className="timer-card">
        <h1>Countdown Timer</h1>

        <div className={`time-display ${isFinished ? 'finished' : ''}`}>
          {formatTime(displayTime)}
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="input-group">
          <div className="input-field">
            <label>Hours</label>
            <input
              type="number"
              min="0"
              max="23"
              value={hours}
              onChange={(e) => setHours(clamp(parseInt(e.target.value), 23))}
              disabled={isRunning}
            />
          </div>
          <div className="input-field">
            <label>Minutes</label>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => setMinutes(clamp(parseInt(e.target.value), 59))}
              disabled={isRunning}
            />
          </div>
          <div className="input-field">
            <label>Seconds</label>
            <input
              type="number"
              min="0"
              max="59"
              value={seconds}
              onChange={(e) => setSeconds(clamp(parseInt(e.target.value), 59))}
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="button-group">
          {!isRunning ? (
            <button className="btn btn-start" onClick={handleStart} disabled={timeLeft === 0 && totalInputSeconds === 0}>
              {timeLeft > 0 ? 'Resume' : 'Start'}
            </button>
          ) : (
            <button className="btn btn-pause" onClick={handlePause}>
              Pause
            </button>
          )}
          <button className="btn btn-reset" onClick={handleReset}>
            Reset
          </button>
        </div>

        {isFinished && <div className="finished-message">⏰ Time's up!</div>}
      </div>
    </div>
  )
}

export default App
