import React from 'react'
import ReactDOM from 'react-dom/client'
import { setDatabaseName } from '../db'
import App from './App'
import '../styles.css'
import './app.css'

// CF MEMO (/) とは記録を分ける
setDatabaseName('fit-memo-db')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
