# Installation Guide

## For Users

### Method 1: Load as Unpacked Extension (Recommended)

1. **Download the extension**

   - Download or clone this repository
   - Or download the latest release from GitHub

2. **Build the extension**

   ```bash
   npm install
   npm run build
   ```

3. **Install in Chrome**

   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top right
   - Click "Load unpacked" button
   - Select the `dist` folder from the project directory
   - The extension should now appear in your extensions list

4. **Start using**
   - Press `Ctrl+A` to enter command mode
   - Press `?` to see all available shortcuts
   - Click the extension icon for a quick reference

### Method 2: Manual Installation from Release

1. **Download** the latest release `.zip` file from GitHub releases
2. **Extract** the zip file to a folder
3. **Follow steps 3-4** from Method 1 above

## For Developers

### Development Installation

1. **Clone and setup**

   ```bash
   git clone https://github.com/jcger/tmux-tab-groups.git
   cd tmux-tab-groups
   npm install
   ```

2. **Development mode**

   ```bash
   npm run dev
   ```

   This will start Vite in development mode with hot reload.

3. **Load in Chrome**

   - Follow the same steps as Method 1 above
   - The extension will automatically reload when you make changes

4. **Production build**
   ```bash
   npm run build
   ```
   This creates an optimized build in the `dist` folder.

## Troubleshooting

### Common Issues

**Extension doesn't load:**

- Make sure you selected the `dist` folder, not the root project folder
- Ensure you ran `npm run build` first
- Check that Developer mode is enabled

**Shortcuts don't work:**

- Make sure no other extension is using `Ctrl+A`
- Try refreshing the current tab
- Check the extension is enabled in `chrome://extensions/`

**Fuzzy finder styles missing:**

- Rebuild the extension with `npm run build`
- Reload the extension in Chrome
- Refresh any open tabs

### Getting Help

- Check the [README](README.md) for usage instructions
- Report issues on [GitHub Issues](https://github.com/jcger/tmux-tab-groups/issues)
- Join discussions on [GitHub Discussions](https://github.com/jcger/tmux-tab-groups/discussions)
