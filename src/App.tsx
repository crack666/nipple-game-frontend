import { useEffect, useState } from 'react';

export function App() {
  const [health, setHealth] = useState<string>('lädt...');

  useEffect(() => {
    fetch('http://localhost:3000/health')
      .then(r => r.json())
      .then(d => setHealth(d.status + ' ' + d.ts))
      .catch(() => setHealth('offline'));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui', padding: '1rem' }}>
      <h1>Bild Rätsel MVP</h1>
      <p>Backend Status: {health}</p>
      <p>Weitere Implementierung folgt...</p>
    </div>
  );
}

export default App;
