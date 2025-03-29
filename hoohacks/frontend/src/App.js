import React, { useState } from "react";

function App() {
  const [description, setDescription] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [useCustomBot, setUseCustomBot] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);

    try {
      const testResponse = await fetch("http://localhost:5001/test");
      if (!testResponse.ok) {
        throw new Error("Backend server is not responding");
      }

      const response = await fetch("http://localhost:5001/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.results) {
        throw new Error("Invalid response format from server");
      }

      setResults(data.results);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.floatingShape1}>❓</div>
      <div style={styles.floatingShape2}>🤖</div>
      <div style={styles.floatingShape3}>💡</div>

      <div style={styles.headingOverlay}>
        <h1 style={styles.mainHeading}>Build-a-BOT</h1>
        <h2 style={styles.subHeading}>Ask anything about your organization 🔍</h2>

        <div style={{ margin: "10px 0" }}>
          <label>
            <input
              type="checkbox"
              checked={useCustomBot}
              onChange={() => setUseCustomBot(!useCustomBot)}
            />{" "}
            Use my own uploaded .txt file
          </label>
        </div>

        {useCustomBot && (
          <div
            style={{
              marginBottom: "1.5rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <input
              type="file"
              accept=".txt"
              onChange={(e) => setUploadFile(e.target.files[0])}
              style={{ marginBottom: "0.5rem" }}
            />
            <button
              style={styles.button}
              onClick={async () => {
                if (!uploadFile) return alert("Please upload a .txt file first.");
                const formData = new FormData();
                formData.append("file", uploadFile);
                const res = await fetch("http://localhost:5001/upload", {
                  method: "POST",
                  body: formData,
                });
                if (res.ok) {
                  alert("✅ File uploaded successfully! You can now ask your bot.");
                } else {
                  alert("❌ Upload failed.");
                }
              }}
            >
              Upload File
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSearch} style={styles.form}>
        <input
          type="text"
          placeholder={useCustomBot ? "Ask your uploaded bot..." : "e.g. How do I become a member?"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>{error}</p>
          <p style={styles.errorHelp}>Please check the console for more details.</p>
        </div>
      )}

      {results.length > 0 && (
        <div style={styles.resultsContainer}>
          <h2 style={styles.resultsHeading}>Answer</h2>
          <div style={styles.scrollableResults}>
            {results.map((result, index) => (
              <div key={index} style={styles.resultItem}>
                <p style={styles.resultText}>{result.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: "relative",
    background: "linear-gradient(135deg, #1f1c2c, #928dab)",
    minHeight: "100vh",
    padding: "0 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
    color: "#fff",
    overflow: "hidden",
  },
  headingOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: "15px 30px",
    borderRadius: "12px",
    marginBottom: "40px",
    backdropFilter: "blur(6px)",
    zIndex: 1,
  },
  mainHeading: {
    fontSize: "40px",
    fontWeight: "bold",
    marginBottom: "8px",
    textShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
  },
  subHeading: {
    fontSize: "20px",
    fontWeight: "lighter",
    margin: 0,
    textShadow: "0 1px 4px rgba(0, 0, 0, 0.3)",
  },
  form: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    padding: "20px",
    borderRadius: "12px",
    backdropFilter: "blur(10px)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "90%",
    maxWidth: "420px",
    margin: "0 auto",
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.25)",
    zIndex: 1,
  },
  input: {
    width: "96%",
    padding: "8px",
    fontSize: "16px",
    borderRadius: "6px",
    border: "none",
    outline: "none",
  },
  button: {
    width: "100%",
    padding: "12px",
    fontSize: "18px",
    backgroundColor: "#6C63FF",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)",
    transition: "0.3s ease all",
  },
  resultsContainer: {
    marginTop: "30px",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "12px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
    maxWidth: "500px",
    width: "100%",
    margin: "20px auto 0",
    color: "#fff",
    padding: "20px",
    backdropFilter: "blur(6px)",
    zIndex: 1,
  },
  resultsHeading: {
    fontSize: "22px",
    fontWeight: "bold",
    marginBottom: "12px",
    textAlign: "left",
  },
  scrollableResults: {
    maxHeight: "300px",
    overflowY: "auto",
  },
  resultItem: {
    borderBottom: "1px solid rgba(255,255,255,0.2)",
    padding: "12px 0",
  },
  resultText: {
    fontSize: "16px",
    color: "#fff",
    margin: 0,
  },
  errorContainer: {
    backgroundColor: "rgba(255, 0, 0, 0.15)",
    padding: "15px",
    borderRadius: "6px",
    margin: "10px 0",
    width: "80%",
    maxWidth: "400px",
    zIndex: 1,
  },
  errorText: {
    color: "#ff4d4d",
    margin: "0 0 5px 0",
    fontWeight: "bold",
  },
  errorHelp: {
    color: "#ccc",
    fontSize: "13px",
    margin: 0,
  },
  floatingShape1: {
    position: "absolute",
    top: "10%",
    left: "5%",
    fontSize: "40px",
    opacity: 0.2,
    animation: "float 6s ease-in-out infinite",
  },
  floatingShape2: {
    position: "absolute",
    bottom: "15%",
    right: "10%",
    fontSize: "50px",
    opacity: 0.15,
    animation: "float 8s ease-in-out infinite",
  },
  floatingShape3: {
    position: "absolute",
    top: "20%",
    right: "20%",
    fontSize: "35px",
    opacity: 0.25,
    animation: "float 7s ease-in-out infinite",
  },
};

export default App;
