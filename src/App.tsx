import { useState, useEffect } from "react";
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { useFormatWorker } from './hooks/useFormatWorker';
import { useChunkedContent } from './hooks/useChunkedContent';
import { EnhancedTextArea } from './components/EnhancedTextArea';
import { ChunkedTextDisplay } from './components/ChunkedTextDisplay';
import "./App.css";

type MenuOption = "json" | "xml" | "jwt" | "base64" | "json-summary";

function App() {
  const [activeMenu, setActiveMenu] = useState<MenuOption>("json");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [hasError, setHasError] = useState(false);
  const [base64Error, setBase64Error] = useState<string>("");
  const [useChunkedMode, setUseChunkedMode] = useState(false);
  const [isFileOpening, setIsFileOpening] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);

  const { formatText: formatWithWorker, cleanup } = useFormatWorker();
  
  // Chunked content management
  const {
    chunks: inputChunks,
    metadata: inputMetadata,
    isLoading: isLoadingInputChunks,
    isLoadingChunk: isLoadingInputChunk,
    currentContentId: inputContentId,
    loadFileContent,
    loadMoreChunks: loadMoreInputChunks,
    clearContent: clearInputContent,
    getCombinedContent: getInputContent,
    isAllContentLoaded: isAllInputLoaded
  } = useChunkedContent();

  const {
    chunks: outputChunks,
    metadata: outputMetadata,
    isLoading: isLoadingOutputChunks,
    isLoadingChunk: isLoadingOutputChunk,
    currentContentId: outputContentId,
    formatContent,
    loadMoreChunks: loadMoreOutputChunks,
    clearContent: clearOutputContent,
    getCombinedContent: getOutputContent,
    isAllContentLoaded: isAllOutputLoaded
  } = useChunkedContent();

  // Cleanup worker on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleMenuSwitch = async (menuOption: MenuOption) => {
    setActiveMenu(menuOption);
    
    // Clear regular text content
    setInputText("");
    setOutputText("");
    setHasError(false);
    setBase64Error("");
    
    // Clear chunked content
    await clearInputContent();
    await clearOutputContent();
    setUseChunkedMode(false);
  };

  

  const clearText = async () => {
    // Clear regular text
    setInputText("");
    setOutputText("");
    setHasError(false);
    setBase64Error("");
    
    // Clear chunked content
    await clearInputContent();
    await clearOutputContent();
    setUseChunkedMode(false);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  // Auto Base64 conversion handlers
  const handleInputChange = async (value: string) => {
    setInputText(value);
    
    // Base64 auto-conversion (only in non-chunked mode)
    if (activeMenu === "base64" && !useChunkedMode) {
      if (value.trim()) {
        try {
          // Try to decode the input as Base64
          const decoded = await formatWithWorker(value, "decode");
          setOutputText(decoded);
          setHasError(false);
          setBase64Error("");
        } catch (error) {
          // If decode fails, show error message
          setOutputText("");
          setHasError(true);
          setBase64Error("Invalid Base64 string");
        }
      } else {
        // Clear output when input is empty
        setOutputText("");
        setHasError(false);
        setBase64Error("");
      }
    }
  };

  const handleOutputChange = async (value: string) => {
    setOutputText(value);
    
    if (activeMenu === "base64") {
      if (value.trim()) {
        try {
          // Encode the output text to Base64
          const encoded = await formatWithWorker(value, "encode");
          setInputText(encoded);
          setHasError(false);
          setBase64Error("");
        } catch (error) {
          // If encode fails, clear input but don't show error for partial typing
          setInputText("");
          setHasError(false);
          setBase64Error("");
        }
      } else {
        // Clear input when output is empty
        setInputText("");
        setHasError(false);
        setBase64Error("");
      }
    }
  };

  const handleOpenFileClick = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'JSON/XML', extensions: ['json', 'xml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!selected || typeof selected !== 'string') return;
    
    setIsFileOpening(true);
    
    // Clear previous content
    await clearInputContent();
    await clearOutputContent();
    setInputText("");
    setOutputText("");
    setHasError(false);
    setBase64Error("");
    
    try {
      const text = await readTextFile(selected);
      
      // Check if content is large enough for chunked mode
      const isLargeContent = text.length > 100000 || text.split('\n').length > 1000;
      
      if (isLargeContent) {
        // Use chunked mode for large files
        await loadFileContent(text);
        setUseChunkedMode(true);
      } else {
        // Use regular mode for small files
        setInputText(text);
        setUseChunkedMode(false);
      }
    } catch (e) {
      console.error("Failed to read file:", e);
      setHasError(true);
    } finally {
      setIsFileOpening(false);
    }
  };



  return (
    <div className="app-container">
      {/* Processing Overlay */}
      {(isFileOpening || isFormatting || isLoadingInputChunks || isLoadingOutputChunks) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <div style={{
            color: 'white',
            fontSize: '16px',
            fontWeight: 500
          }}>
            {isFileOpening 
              ? "Opening file..." 
              : (activeMenu === "jwt" ? "Parsing..." : activeMenu === "json-summary" ? "Summarizing..." : "Formatting...")}
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      
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
            {activeMenu !== "base64" && (
              <button onClick={async () => {
                // Set loading state immediately
                setIsFormatting(true);
                
                // Force UI update by yielding control to the event loop
                await new Promise(resolve => setTimeout(resolve, 50));
                
                try {
                  if (useChunkedMode && inputContentId) {
                    await clearOutputContent();
                    await formatContent(inputContentId, activeMenu);
                  } else if (inputText.trim()) {
                    // Use the format worker with the correct menu type
                    const formatted = await formatWithWorker(inputText, activeMenu);
                    setOutputText(formatted);
                  }
                } catch (error) {
                  if (useChunkedMode) {
                    setHasError(true);
                  } else {
                    setOutputText(`Error: ${error instanceof Error ? error.message : 'Invalid input'}`);
                  }
                } finally {
                  setIsFormatting(false);
                }
              }} disabled={isFileOpening || isFormatting || isLoadingOutputChunks || (!inputText.trim() && !inputContentId)}>
                {(isFormatting || isLoadingOutputChunks)
                  ? (activeMenu === "jwt" ? "Parsing..." : activeMenu === "json-summary" ? "Summarizing..." : "Formatting...") 
                  : (activeMenu === "jwt" ? "Parse" : activeMenu === "json-summary" ? "Summarize" : "Format")}
              </button>
            )}
            <button onClick={clearText} className="clear-btn">
              Clear
            </button>
          </div>
        </div>
        {activeMenu === "base64" && (
          <div style={{ 
            background: '#e8f4fd', 
            border: '1px solid #bee5eb', 
            borderRadius: '4px', 
            padding: '8px 12px', 
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: '#0c5460',
            textAlign: 'center'
          }}>
            💡 Type or paste text, and the other side updates automatically.
          </div>
        )}
        {activeMenu === "base64" && base64Error && (
          <div style={{ 
            background: '#f8d7da', 
            border: '1px solid #f5c6cb', 
            borderRadius: '4px', 
            padding: '8px 12px', 
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: '#721c24',
            textAlign: 'center',
            fontWeight: 500
          }}>
            ⚠️ {base64Error}
          </div>
        )}
        <div className="formatter-container">
          <div className="input-section">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: '20px' }}>
              <h3 style={{ margin: 0 }}>
                {activeMenu === "base64" ? "Encoded Text" : "Input"}
              </h3>
              {(activeMenu === "json" || activeMenu === "xml" || activeMenu === "json-summary") && (
                <>
                  <button 
                    onClick={handleOpenFileClick} 
                    disabled={isFileOpening || isFormatting}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '12px', 
                      backgroundColor: (isFileOpening || isFormatting) ? '#95a5a6' : '#3498db', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px', 
                      cursor: (isFileOpening || isFormatting) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    📁 {isFileOpening ? 'Opening...' : 'Open File'}
                  </button>
                  <span style={{
                    fontSize: '11px',
                    color: '#999',
                    fontStyle: 'italic',
                    marginLeft: '8px'
                  }}>
                    Recommended for files over 1000 lines or 1MB for optimal performance
                  </span>
                </>
              )}
              {inputText && activeMenu === "base64" && (
                <button 
                  onClick={() => copyToClipboard(inputText)} 
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '11px', 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '3px', 
                    cursor: 'pointer'
                  }}
                >
                  📋 Copy
                </button>
              )}
              <div style={{ flex: 1 }}></div>
            </div>
            {useChunkedMode ? (
              <ChunkedTextDisplay
                content={getInputContent()}
                isLoading={isLoadingInputChunks}
                isLoadingChunk={isLoadingInputChunk}
                onLoadMore={() => {
                  const nextChunkIndex = Math.floor(inputChunks.length);
                  loadMoreInputChunks(nextChunkIndex, 2); // Load 2 chunks at a time
                }}
                isAllLoaded={isAllInputLoaded()}
                placeholder={
                  activeMenu === "jwt" 
                    ? "Large JWT content loaded..." 
                    : activeMenu === "json-summary"
                      ? "Large JSON content loaded..."
                      : `Large ${activeMenu.toUpperCase()} content loaded...`
                }
                className="text-area"
                readOnly={true}
              />
            ) : (
              <EnhancedTextArea
                value={inputText}
                onChange={(value) => activeMenu === "base64" ? handleInputChange(value) : setInputText(value)}
                placeholder={
                  activeMenu === "jwt" 
                    ? "Paste your JWT token here..." 
                    : activeMenu === "base64"
                      ? "Paste Base64 encoded text here..."
                      : activeMenu === "json-summary"
                        ? "Paste your JSON here to get a summary..."
                        : `Paste your ${activeMenu.toUpperCase()} here...`
                }
                className="text-area"
              />
            )}
          </div>

          <div className="output-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, minHeight: '28px' }}>
              <h3 style={{ margin: 0, flex: 1 }}>
                {activeMenu === "jwt" 
                  ? "Parsed JWT" 
                  : activeMenu === "base64"
                    ? "Decoded Text"
                    : activeMenu === "json-summary"
                      ? "JSON Summary"
                      : "Formatted Output"}
              </h3>
              {outputText && (
                <button 
                  onClick={() => copyToClipboard(outputText)} 
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '11px', 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '3px', 
                    cursor: 'pointer'
                  }}
                >
                  📋 Copy
                </button>
              )}
            </div>
            {useChunkedMode && outputContentId ? (
              <ChunkedTextDisplay
                content={getOutputContent()}
                isLoading={isLoadingOutputChunks}
                isLoadingChunk={isLoadingOutputChunk}
                onLoadMore={() => {
                  const nextChunkIndex = Math.floor(outputChunks.length);
                  loadMoreOutputChunks(nextChunkIndex, 2); // Load 2 chunks at a time
                }}
                isAllLoaded={isAllOutputLoaded()}
                placeholder={
                  activeMenu === "jwt" 
                    ? "Parsed JWT content will appear here..." 
                    : activeMenu === "json-summary"
                      ? "JSON summary will appear here..."
                      : "Formatted output will appear here..."
                }
                className={`text-area output ${hasError ? 'error' : ''}`}
                readOnly={true}
              />
            ) : (
              <EnhancedTextArea
                value={outputText}
                readOnly={activeMenu !== "base64"}
                onChange={(value) => activeMenu === "base64" ? handleOutputChange(value) : undefined}
                placeholder={
                  activeMenu === "jwt" 
                    ? "Parsed JWT will appear here..." 
                    : activeMenu === "base64"
                      ? "Enter plain text here to encode..."
                      : activeMenu === "json-summary"
                        ? "JSON summary will appear here..."
                        : "Formatted output will appear here..."
                }
                className={`text-area output ${hasError ? 'error' : ''}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
