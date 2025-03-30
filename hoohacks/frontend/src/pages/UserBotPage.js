import React, { useState } from 'react';

function UserBotPage() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert('Please select a .txt file first.');

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('http://localhost:5001/upload', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      alert('File uploaded successfully. You can now ask questions!');
    } else {
      alert('Failed to upload file.');
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;

    setLoading(true);
    const res = await fetch('http://localhost:5001/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: question }),
    });

    const data = await res.json();
    setResponse(data.results?.[0]?.description || 'No response');
    setLoading(false);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: 'auto' }}>
      <h2>🧠 Upload Your Own Bot</h2>

      <input
        type="file"
        accept=".txt"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button onClick={handleUpload} style={{ marginLeft: '1rem' }}>
        Upload
      </button>

      <hr style={{ margin: '2rem 0' }} />

      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask your chatbot something..."
        style={{ width: '100%', padding: '0.5rem' }}
      />
      <button onClick={handleAsk} style={{ marginTop: '1rem' }}>
        {loading ? 'Asking...' : 'Ask'}
      </button>

      {response && (
        <div style={{ marginTop: '2rem', background: '#f5f5f5', padding: '1rem' }}>
          <strong>Response:</strong>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}

export default UserBotPage;
