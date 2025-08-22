import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type MenuOption = "json" | "xml" | "jwt" | "base64" | "json-summary";

function App() {
  const [activeMenu, setActiveMenu] = useState<MenuOption>("json");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [base64Mode, setBase64Mode] = useState<"encode" | "decode">("encode");

  const handleMenuSwitch = (menuOption: MenuOption) => {
    setActiveMenu(menuOption);
    setInputText("");
    setOutputText("");
    setHasError(false);
  };

  const handleBase64ModeSwitch = (mode: "encode" | "decode") => {
    setBase64Mode(mode);
    setInputText("");
    setOutputText("");
    setHasError(false);
  };

  const formatText = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setHasError(false);
    try {
      const formatted = await invoke("format_text", {
        text: inputText,
        formatType: activeMenu === "base64" ? base64Mode : activeMenu,
      });
      setOutputText(formatted as string);
    } catch (error) {
      setOutputText(`Error: ${error}`);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const clearText = () => {
    setInputText("");
    setOutputText("");
    setHasError(false);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <h2>DevMate</h2>
        <nav className="nav-menu">
          <button
            className={`menu-item ${activeMenu === "json" ? "active" : ""}`}
            onClick={() => handleMenuSwitch("json")}
          >
            JSON Format
          </button>
          <button
            className={`menu-item ${activeMenu === "xml" ? "active" : ""}`}
            onClick={() => handleMenuSwitch("xml")}
          >
            XML Format
          </button>
          <button
            className={`menu-item ${activeMenu === "jwt" ? "active" : ""}`}
            onClick={() => handleMenuSwitch("jwt")}
          >
            JWT Parser
          </button>
          <button
            className={`menu-item ${activeMenu === "base64" ? "active" : ""}`}
            onClick={() => handleMenuSwitch("base64")}
          >
            Base64 Encoder/Decoder
          </button>
          <button
            className={`menu-item ${activeMenu === "json-summary" ? "active" : ""}`}
            onClick={() => handleMenuSwitch("json-summary")}
          >
            JSON Summarizer
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="content-header">
          <h1>
            {activeMenu === "jwt" 
              ? "JWT Parser" 
              : activeMenu === "base64" 
                ? "Base64 Encoder/Decoder"
                : activeMenu === "json-summary"
                  ? "JSON Summarizer"
                : `${activeMenu.toUpperCase()} Formatter`}
          </h1>
          <div className="action-buttons">
            {activeMenu === "base64" && (
              <div className="base64-mode-selector">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="base64Mode"
                    value="encode"
                    checked={base64Mode === "encode"}
                    onChange={() => handleBase64ModeSwitch("encode")}
                  />
                  <span className="radio-label">Encode</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="base64Mode"
                    value="decode"
                    checked={base64Mode === "decode"}
                    onChange={() => handleBase64ModeSwitch("decode")}
                  />
                  <span className="radio-label">Decode</span>
                </label>
              </div>
            )}
            <button onClick={formatText} disabled={isLoading}>
              {isLoading 
                ? (activeMenu === "jwt" ? "Parsing..." : activeMenu === "base64" ? `${base64Mode === "encode" ? "Encoding" : "Decoding"}...` : activeMenu === "json-summary" ? "Summarizing..." : "Formatting...") 
                : (activeMenu === "jwt" ? "Parse" : activeMenu === "base64" ? (base64Mode === "encode" ? "Encode" : "Decode") : activeMenu === "json-summary" ? "Summarize" : "Format")}
            </button>
            <button onClick={clearText} className="clear-btn">
              Clear
            </button>
          </div>
        </div>

        <div className="formatter-container">
          <div className="input-section">
            <h3>Input</h3>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeMenu === "jwt" 
                  ? "Paste your JWT token here..." 
                  : activeMenu === "base64"
                    ? (base64Mode === "encode" ? "Enter text to encode..." : "Enter base64 text to decode...")
                    : activeMenu === "json-summary"
                      ? "Paste your JSON here to get a summary..."
                      : `Paste your ${activeMenu.toUpperCase()} here...`
              }
              className="text-area"
            />
          </div>

          <div className="output-section">
            <h3>
              {activeMenu === "jwt" 
                ? "Parsed JWT" 
                : activeMenu === "base64"
                  ? (base64Mode === "encode" ? "Encoded Base64" : "Decoded Text")
                  : activeMenu === "json-summary"
                    ? "JSON Summary"
                    : "Formatted Output"}
            </h3>
            <textarea
              value={outputText}
              readOnly
              placeholder={
                activeMenu === "jwt" 
                  ? "Parsed JWT will appear here..." 
                  : activeMenu === "base64"
                    ? (base64Mode === "encode" ? "Encoded base64 will appear here..." : "Decoded text will appear here...")
                    : activeMenu === "json-summary"
                      ? "JSON summary will appear here..."
                      : "Formatted output will appear here..."
              }
              className={`text-area output ${hasError ? 'error' : ''}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
