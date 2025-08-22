# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

# DevMate

A powerful developer utility application built with Tauri and React that provides various text formatting and parsing tools.

## Features

- **JSON Formatter**: Format and prettify JSON data
- **XML Formatter**: Format XML with proper indentation
- **JWT Parser**: Decode and analyze JWT tokens
- **Base64 Encoder/Decoder**: Encode text to Base64 or decode Base64 to text
- **JSON Summarizer**: Get structural analysis and statistics of JSON data

## Prerequisites

Before running this application, make sure you have the following installed:

### System Requirements

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Rust** (latest stable) - [Install here](https://rustup.rs/)
- **npm** or **yarn** package manager

### Platform-specific Dependencies

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

#### Windows
- Install Microsoft Visual Studio C++ Build Tools
- Install WebView2 (usually pre-installed on Windows 10/11)

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DevMate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Rust dependencies**
   ```bash
   cd src-tauri
   cargo build
   cd ..
   ```

## Running the Application

### Development Mode

To run the application in development mode with hot reload:

```bash
npm run tauri dev
```

This will:
- Start the React development server
- Launch the Tauri application window
- Enable hot reload for both frontend and backend changes

### Production Build

To build the application for production:

```bash
npm run tauri build
```

This will create optimized builds in:
- `src-tauri/target/release/` (executable)
- `src-tauri/target/release/bundle/` (platform-specific installers)

## Available Scripts

- `npm run dev` - Start React development server only
- `npm run build` - Build React app for production
- `npm run tauri dev` - Run in development mode with Tauri
- `npm run tauri build` - Build production application
- `npm run preview` - Preview production build

## Usage

1. **Launch the application** using one of the methods above
2. **Select a tool** from the sidebar:
   - JSON Format
   - XML Format
   - JWT Parser
   - Base64 Encoder/Decoder
   - JSON Summarizer
3. **Input your data** in the left text area
4. **Click the action button** (Format/Parse/Encode/Decode/Summarize)
5. **View results** in the right text area

### Tool-Specific Features

#### JSON Formatter
- Validates and prettifies JSON
- Shows syntax errors with helpful messages

#### XML Formatter
- Formats XML with proper indentation
- Keeps text-only elements on single lines
- Validates XML structure

#### JWT Parser
- Decodes JWT header and payload
- Shows token structure and claims
- Displays signature information
- Validates JWT format

#### Base64 Encoder/Decoder
- Switch between encode and decode modes using radio buttons
- Handles text encoding/decoding
- Shows UTF-8 validation errors

#### JSON Summarizer
- Analyzes JSON structure with visual indicators
- Shows data type information
- Provides statistics (objects, arrays, depth, etc.)
- Detects mixed array types

## Troubleshooting

### Common Issues

1. **Rust compilation errors**
   ```bash
   # Update Rust
   rustup update
   
   # Clean and rebuild
   cd src-tauri
   cargo clean
   cargo build
   ```

2. **Node.js dependency issues**
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Platform-specific build issues**
   - **Linux**: Ensure all webkit and gtk dependencies are installed
   - **macOS**: Make sure Xcode Command Line Tools are updated
   - **Windows**: Verify Visual Studio Build Tools and WebView2 are installed

### Development Tips

- Use `npm run tauri dev` for development with hot reload
- Check browser developer tools in development mode
- Rust backend logs appear in the terminal
- Frontend errors appear in the browser console

## Project Structure

```
DevMate/
├── src/                    # React frontend source
│   ├── App.tsx            # Main application component
│   ├── App.css            # Application styles
│   └── main.tsx           # React entry point
├── src-tauri/             # Rust backend source
│   ├── src/
│   │   ├── lib.rs         # Main Rust logic
│   │   └── main.rs        # Tauri entry point
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── package.json           # Node.js dependencies
└── README.md             # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license information here]

## Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Search existing issues in the repository
3. Create a new issue with detailed information about your problem
