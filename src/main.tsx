// [요구사항: 개발 프레임워크] React 18 진입점
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root 요소를 찾을 수 없습니다.');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
