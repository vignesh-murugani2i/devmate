import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import ChunkedTextarea from './components/ChunkedTextarea';
import "./App.css";

type MenuOption = "json" | "xml" | "jwt" | "base64" | "json-summary";

function App() {
  const [activeMenu, setActiveMenu] = useState<MenuOption>("json");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [base64Error, setBase64Error] = useState<string>("");
  const [isLoadingFromFile, setIsLoadingFromFile] = useState(false);
  const [useChunkedLoading, setUseChunkedLoading] = useState(false);
  const [chunkedInputKey, setChunkedInputKey] = useState(0);
  const [chunkedOutputKey, setChunkedOutputKey] = useState(0);
  const [inputCopied, setInputCopied] = useState(false);
  const [outputCopied, setOutputCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleMenuSwitch = async (menuOption: MenuOption) => {
    setActiveMenu(menuOption);
    setInputText("");
    setOutputText("");
    setHasError(false);
    setUseChunkedLoading(false);
    // Reset chunked components by changing keys
    setChunkedInputKey(prev => prev + 1);
    setChunkedOutputKey(prev => prev + 1);
  };

  const formatText = async () => {
    if (!inputText.trim() && !useChunkedLoading) return;

    setIsLoading(true);
    setHasError(false);
    
    // Add a small delay to ensure the loader shows before heavy processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      let textToFormat = inputText;
      
      // If using chunked loading, get the raw content from backend first
      if (useChunkedLoading) {
        const info = await invoke("get_content_info") as any;
        if (!info.has_raw) {
          throw new Error("No content available for formatting");
        }
        // Backend will format the stored raw content
        textToFormat = ""; // Not used when backend has stored content
      }
      
      const formatted = await invoke("format_text", {
        text: textToFormat,
        formatType: activeMenu,
      });
      
      if (useChunkedLoading) {
        // Reset the chunked output component to load formatted content
        setChunkedOutputKey(prev => prev + 1);
      } else {
        setOutputText(formatted as string);
      }
    } catch (error) {
      setOutputText(`Error: ${error}`);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const clearText = async () => {
    setInputText("");
    setOutputText("");
    setHasError(false);
    setBase64Error("");
    setUseChunkedLoading(false);
    
    // Clear backend storage
    try {
      await invoke("clear_content");
    } catch (error) {
      console.error("Failed to clear backend storage:", error);
    }
    
    // Reset chunked components
    setChunkedInputKey(prev => prev + 1);
    setChunkedOutputKey(prev => prev + 1);
  };

  const copyToClipboard = async (text: string, type: 'input' | 'output') => {
    try {
      await navigator.clipboard.writeText(text);
      
      // Show "Copied!" feedback
      if (type === 'input') {
        setInputCopied(true);
        setTimeout(() => setInputCopied(false), 2000);
      } else {
        setOutputCopied(true);
        setTimeout(() => setOutputCopied(false), 2000);
      }
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const downloadFormattedJson = async () => {
    if (activeMenu !== "json") return;
    
    setIsDownloading(true);
    
    try {
      let contentToDownload = "";
      
      if (useChunkedLoading) {
        // Get the full formatted content from backend
        const info = await invoke("get_content_info") as any;
        
        if (!info.has_formatted) {
          throw new Error("No formatted content available for download");
        }
        
        // Get the entire formatted content in one request
        const result = await invoke('get_content_chunk', {
          contentType: 'formatted',
          start: 0,
          chunkSize: info.formatted_length
        }) as any;
        
        contentToDownload = result.chunk;
      } else {
        // Use the output text for smaller files
        contentToDownload = outputText;
      }
      
      if (!contentToDownload.trim()) {
        throw new Error("No content to download");
      }
      
      // Create blob and download
      const blob = new Blob([contentToDownload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `formatted_${Date.now()}.json`;
      a.style.display = 'none';
      document.body.appendChild(a);
      
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      // Show success feedback
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
      
    } catch (error) {
      console.error("Failed to download file:", error);
      alert(`Download failed: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Auto Base64 conversion handlers
  const handleInputChange = async (value: string) => {
    setInputText(value);
    
    // Skip Base64 auto-conversion if we're loading from file
    if (activeMenu === "base64" && !isLoadingFromFile) {
      if (value.trim()) {
        try {
          // Try to decode the input as Base64
          const decoded = await invoke("format_text", {
            text: value,
            formatType: "decode",
          });
          setOutputText(decoded as string);
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
          const encoded = await invoke("format_text", {
            text: value,
            formatType: "encode",
          });
          setInputText(encoded as string);
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
    
    // Set loading states
    setIsFileLoading(true);
    setIsLoadingFromFile(true);
    
    // Clear output and errors when loading new file
    setOutputText("");
    setHasError(false);
    setBase64Error("");
    
    try {
      // First, try to use the streaming approach for large files
      try {
        const streamResult = await invoke("read_large_file_streaming", { filePath: selected }) as any;
        
        if (streamResult.use_streaming) {
          // Large file was handled by backend streaming
          console.log(`Large file loaded: ${streamResult.file_size} bytes using streaming`);
          setUseChunkedLoading(true);
          setInputText(""); // Clear frontend text
          // Trigger chunked component to reload
          setChunkedInputKey(prev => prev + 1);
        } else {
          // File is small enough for frontend to handle
          const text = await readTextFile(selected);
          const shouldUseChunked = text.length > 50000; // 50KB threshold
          
          if (shouldUseChunked) {
            // Store content in backend and use chunked loading
            await invoke("store_raw_content", { content: text });
            setUseChunkedLoading(true);
            setInputText(""); // Clear frontend text
            // Trigger chunked component to reload
            setChunkedInputKey(prev => prev + 1);
          } else {
            // Use traditional loading for smaller files
            setUseChunkedLoading(false);
            setInputText(text);
          }
        }
      } catch (streamError) {
        // Fallback to traditional approach if streaming fails
        console.warn("Streaming approach failed, trying traditional:", streamError);
        const text = await readTextFile(selected);
        
        // Determine if we should use chunked loading
        const shouldUseChunked = text.length > 50000;
        
        if (shouldUseChunked) {
          await invoke("store_raw_content", { content: text });
          setUseChunkedLoading(true);
          setInputText("");
          setChunkedInputKey(prev => prev + 1);
        } else {
          setUseChunkedLoading(false);
          setInputText(text);
        }
      }
    } catch (e) {
      console.error("Failed to read file:", e);
      alert(`Failed to read file: ${e}. The file might be too large for this browser to handle.`);
    } finally {
      setIsFileLoading(false);
      setIsLoadingFromFile(false);
    }
  };



  return (
    <div className="app-container">
      {/* File Loading Overlay */}
      {isFileLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
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
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Format Processing Overlay */}
      {isLoading && (
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
            {activeMenu === "jwt" ? "Parsing..." : activeMenu === "json-summary" ? "Summarizing..." : "Formatting..."}
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
              <button onClick={formatText} disabled={isLoading}>
                {isLoading 
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
        {useChunkedLoading && (
          <div style={{ 
            background: '#fff3cd', 
            border: '1px solid #ffeeba', 
            borderRadius: '4px', 
            padding: '8px 12px', 
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: '#856404',
            textAlign: 'center'
          }}>
            📄 Large file loaded - Content is fetched on demand as you scroll
          </div>
        )}
        <div className="formatter-container">
          <div className="input-section">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: '20px' }}>
              <h3 style={{ margin: 0 }}>
                {activeMenu === "base64" ? "Encoded Text" : "Input"}
              </h3>
              {(activeMenu === "json" || activeMenu === "json-summary") && (
                <button 
                  onClick={handleOpenFileClick} 
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '12px', 
                    backgroundColor: '#3498db', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer'
                  }}
                >
                  Open File
                </button>
              )}
              {((inputText && activeMenu === "base64") || useChunkedLoading) && (
                <button 
                  onClick={() => {
                    if (useChunkedLoading) {
                      (window as any).copyChunked_raw?.();
                      setInputCopied(true);
                      setTimeout(() => setInputCopied(false), 2000);
                    } else {
                      copyToClipboard(inputText, 'input');
                    }
                  }} 
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '11px', 
                    backgroundColor: inputCopied ? '#6c757d' : '#28a745', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '3px', 
                    cursor: 'pointer'
                  }}
                >
                  {inputCopied ? '✓ Copied!' : '📋 Copy'}
                </button>
              )}
              <div style={{ flex: 1 }}></div>
            </div>
            {useChunkedLoading ? (
              <ChunkedTextarea
                key={chunkedInputKey}
                contentType="raw"
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
                readOnly={true}
                onCopyAll={() => {
                  setInputCopied(true);
                  setTimeout(() => setInputCopied(false), 2000);
                }}
              />
            ) : (
              <textarea
                value={inputText}
                onChange={(e) => activeMenu === "base64" ? handleInputChange(e.target.value) : setInputText(e.target.value)}
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
              <div style={{ display: 'flex', gap: '8px' }}>
                {(outputText || (useChunkedLoading && activeMenu !== "base64")) && (
                  <button 
                    onClick={() => {
                      if (useChunkedLoading) {
                        (window as any).copyChunked_formatted?.();
                        setOutputCopied(true);
                        setTimeout(() => setOutputCopied(false), 2000);
                      } else {
                        copyToClipboard(outputText, 'output');
                      }
                    }} 
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '11px', 
                      backgroundColor: outputCopied ? '#6c757d' : '#28a745', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '3px', 
                      cursor: 'pointer'
                    }}
                  >
                    {outputCopied ? '✓ Copied!' : '📋 Copy'}
                  </button>
                )}
                {activeMenu === "json" && (outputText.trim() || useChunkedLoading) && (
                  <button 
                    onClick={downloadFormattedJson}
                    disabled={isDownloading}
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '11px', 
                      backgroundColor: downloadSuccess ? '#28a745' : isDownloading ? '#6c757d' : '#007bff',
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '3px', 
                      cursor: isDownloading ? 'not-allowed' : 'pointer',
                      opacity: isDownloading ? 0.7 : 1
                    }}
                  >
                    {downloadSuccess ? '✓ Downloaded!' : isDownloading ? '⏳ Downloading...' : '💾 Download'}
                  </button>
                )}
              </div>
            </div>
            {useChunkedLoading && activeMenu !== "base64" ? (
              <ChunkedTextarea
                key={chunkedOutputKey}
                contentType="formatted"
                placeholder={
                  activeMenu === "jwt" 
                    ? "Parsed JWT will appear here..." 
                    : activeMenu === "json-summary"
                      ? "JSON summary will appear here..."
                      : "Formatted output will appear here..."
                }
                className={`text-area output ${hasError ? 'error' : ''}`}
                readOnly={true}
                onCopyAll={() => {
                  setOutputCopied(true);
                  setTimeout(() => setOutputCopied(false), 2000);
                }}
              />
            ) : (
              <textarea
                value={outputText}
                readOnly={activeMenu !== "base64"}
                onChange={(e) => activeMenu === "base64" ? handleOutputChange(e.target.value) : undefined}
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
