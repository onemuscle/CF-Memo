import React from 'react'
import ReactDOM from 'react-dom/client'
import { setDatabaseName } from '../db'
import App from './App'
import { applyTheme, savedTheme } from './theme'
import '../styles.css'
import './app.css'

// CF MEMO (/) とは記録を分ける。旧名 (FIT MEMO) のときに保存した記録を引き継ぐため、DB名はそのまま
setDatabaseName('fit-memo-db')
// 前回のテーマを描画前に当てて、黒からの切り替わりのちらつきを防ぐ
applyTheme(savedTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
