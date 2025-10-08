# Tmux Tab Groups

A Chrome extension that brings tmux-inspired keyboard navigation to browser tab groups. Navigate and manage your tab groups efficiently using familiar tmux-style keyboard shortcuts.

## What is it?

Tmux Tab Groups transforms your browser tab management experience by providing:

- **Keyboard-first navigation** - Control your tabs without touching the mouse
- **Tmux-inspired shortcuts** - Familiar commands for tmux users
- **Tab group management** - Create, organize, and hibernate tab groups
- **Fuzzy finding** - Quickly jump to any group
- **Session persistence** - Save and restore tab groups as bookmarks

## Usage Guide

### Basic Commands

All commands start with the prefix key: **`Ctrl+A`**

After pressing `Ctrl+A`, use these keys:

#### Navigation

- `n` - Next tab
- `p` - Previous tab
- `l` - Last (previously active) tab

#### Quick Select

- `1-9` - Jump to tab 1-9 in current group
- `0` - Jump to tab 10 in current group

#### Group & Tab Management

- `c` - Create new tab in current group
- `g` - Create new tab group
- `a` - Add last tab to current group
- `x` - Hibernate current group (save to bookmarks)
- `f` - Open fuzzy finder for quick navigation

#### Help

- `?` - Show help window with all shortcuts

## Quick Start

### Installation (Development)

Since this extension isn't yet published on the Chrome Web Store, you'll need to install it manually:

1. **Clone the repository**

   ```bash
   git clone https://github.com/jcger/tmux-tabs-groups.git
   cd tab-group-manager-extension
   ```

2. **Install dependencies and build**

   ```bash
   npm install
   npm run build
   ```

3. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from the project

4. **Start using**
   - Press `Ctrl+A` to enter command mode
   - Press `?` for help and available shortcuts

## Customization

### Changing the Prefix Key

The default prefix key is `Ctrl+A` (sorry but I don't use tmux default), but you can customize it in `chrome://extensions/shortcuts`

## Development

### Build Commands

```bash
npm run dev      # Development mode with hot reload
npm run build    # Production build
npm run preview  # Preview built extension
```

## Troubleshooting

### Commands Not Working on Certain Websites

Some websites (especially Google Docs) capture keyboard events and may prevent the extension from working properly. In this scenario, use browser shortcuts to move to prev/next tab

**Note**:

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## Privacy

This extension does not collect or transmit any personal data. All tab information is stored locally on your device. See our [Privacy Policy](PRIVACY.md) for details.

## 🙏 Acknowledgments

- Inspired by [tmux](https://github.com/tmux/tmux) - the terminal multiplexer
- Built for productivity enthusiasts who prefer keyboard navigation
- Thanks to the Chrome Extensions API team for the powerful tab management capabilities
