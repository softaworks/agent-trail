# AgentTrail - Multi-Directory Claude Code Session Viewer

## Project Overview

AgentTrail is a local web-based viewer for browsing Claude Code conversation history across multiple directories. Unlike Cloister (which only reads from `~/.claude`), AgentTrail allows users to configure multiple session directories, making it ideal for users who work across different machines, projects, or have multiple Claude Code installations.

### Key Differentiators from Cloister

1. **Multi-directory support**: Configure and view sessions from multiple directories
2. **Config-based setup**: Persistent configuration stored in `~/.config/agenttrail/config.json`
3. **Directory-isolated session chaining**: Sessions are only chained within the same directory
4. **Pins and custom tags**: Mark important sessions and add custom tags through config
5. **Enhanced search**: Quick search (titles only) and deep search (full message content)
6. **Settings modal**: In-app configuration management
7. **Custom identity**: Different branding, port (9847), and visual theme

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Bun** | JavaScript runtime and bundler |
| **ElysiaJS** | Web framework (replacing Hono from Cloister) |
| **TypeScript** | Type-safe development |
| **Vanilla JS** | Frontend (no framework, following Cloister pattern) |
| **CSS** | Custom styling with dark theme |

## Features

### 1. Multi-Directory Session Discovery

- Scan multiple configured directories for Claude Code sessions
- Each directory can have a custom label and color
- Sessions grouped by directory in the UI with collapsible sections
- Directory-specific session chaining (sessions only chain within same directory)

### 2. Session Viewing

- Parse JSONL session files
- Display messages with proper formatting
- Render tool calls (Read, Edit, Write, Bash, etc.)
- Syntax highlighting for code blocks
- Markdown rendering for text content
- Thinking block display (collapsible)

### 3. Session Status Tracking

- **Idle**: No recent activity
- **Working**: Claude is currently processing
- **Awaiting**: Claude is waiting for user input
- Real-time status updates via SSE (Server-Sent Events)

### 4. Auto-Tagging

Built-in tag detection based on message content:
- `debugging` - Bug fixes, error investigation
- `feature` - New feature implementation
- `refactoring` - Code restructuring
- `git` - Version control operations
- `testing` - Test-related work
- `docs` - Documentation work
- `config` - Configuration changes
- `api` - API development
- `ui` - Frontend/UI work

### 5. Pins and Custom Tags

Through the config file, users can:
- Pin important sessions (appear at top of list)
- Add custom tags to specific sessions
- Tags persist across restarts

### 6. Search

- **Quick Search**: Filter by session title, project name, tags
- **Deep Search**: Full-text search through message content
- Toggle between quick and deep search modes

### 7. Filtering

- Time-based: All, Today, This Week
- By tag (including custom tags)
- By directory
- By project

### 8. Settings Modal

In-app settings management:
- Add/remove session directories
- Set directory labels and colors
- Manage pins
- View/edit config file path

### 9. File Watching

- Real-time updates when session files change
- New messages appear automatically
- Status changes reflected immediately

## Configuration

### Config File Location

```
~/.config/agenttrail/config.json
```

### Config Schema

```typescript
interface AgentTrailConfig {
  // Session directories to scan
  directories: DirectoryConfig[];

  // Pinned session IDs (appear at top)
  pins: string[];

  // Custom tags for specific sessions
  customTags: {
    [sessionId: string]: string[];
  };

  // Server settings
  server: {
    port: number;  // Default: 9847
  };
}

interface DirectoryConfig {
  // Absolute path to the directory
  path: string;

  // Display label (e.g., "Work Laptop", "Personal")
  label: string;

  // Color for UI distinction (CSS color value)
  color: string;

  // Whether this directory is enabled
  enabled: boolean;
}
```

### Example Config

```json
{
  "directories": [
    {
      "path": "/home/user/.claude/projects",
      "label": "Default",
      "color": "#7c3aed",
      "enabled": true
    },
    {
      "path": "/mnt/backup/claude-sessions",
      "label": "Backup",
      "color": "#2563eb",
      "enabled": true
    }
  ],
  "pins": [
    "abc123-session-id",
    "def456-session-id"
  ],
  "customTags": {
    "abc123-session-id": ["important", "review-later"]
  },
  "server": {
    "port": 9847
  }
}
```

## API Endpoints

### Sessions

#### `GET /api/sessions`

List all sessions from all enabled directories.

**Response:**
```typescript
{
  sessions: Session[];
}

interface Session {
  id: string;
  directory: string;        // Source directory path
  directoryLabel: string;   // Directory display label
  directoryColor: string;   // Directory color
  project: string;          // Project path
  projectName: string;      // Project name (last segment)
  title: string;            // Auto-generated or user-set title
  timestamp: string;        // First message timestamp
  lastModified: string;     // File modification time
  messageCount: number;
  tags: string[];           // Auto + custom tags
  status: "awaiting" | "working" | "idle";
  filePath: string;         // Full path to session file
  isPinned: boolean;
  chainId?: string;
  chainIndex?: number;
  chainLength?: number;
}
```

#### `GET /api/sessions/:id`

Get session details with all messages.

**Response:**
```typescript
{
  session: SessionDetail;
}

interface SessionDetail extends Session {
  messages: Message[];
}

interface Message {
  id: string;
  type: "user" | "assistant";
  timestamp: string;
  content: ContentBlock[];
}

interface ContentBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking";
  text?: string;
  name?: string;
  id?: string;
  tool_use_id?: string;
  input?: Record<string, unknown>;
  content?: string | ContentBlock[];
  thinking?: string;
}
```

#### `GET /api/sessions/:id/events`

SSE endpoint for real-time session updates.

**Events:**
- `message` - New message added
- `status` - Session status changed
- `ping` - Keep-alive (every 30s)

### Directories

#### `GET /api/directories`

List configured directories.

**Response:**
```typescript
{
  directories: DirectoryConfig[];
}
```

### Projects

#### `GET /api/projects`

List all projects across all directories.

**Response:**
```typescript
{
  projects: {
    name: string;
    path: string;
    directory: string;
    count: number;
  }[];
}
```

### Tags

#### `GET /api/tags`

Get tag counts (auto + custom tags).

**Response:**
```typescript
{
  tags: {
    [tagName: string]: number;
  };
}
```

### Search

#### `GET /api/search?q=<query>&mode=<quick|deep>`

Search sessions.

**Query Parameters:**
- `q` - Search query
- `mode` - `quick` (titles only) or `deep` (full content)

**Response:**
```typescript
{
  results: Session[];
  mode: "quick" | "deep";
  query: string;
}
```

### Config

#### `GET /api/config`

Get current configuration.

**Response:**
```typescript
{
  config: AgentTrailConfig;
  configPath: string;
}
```

#### `PUT /api/config`

Update configuration.

**Request Body:** `AgentTrailConfig`

**Response:**
```typescript
{
  success: boolean;
  config: AgentTrailConfig;
}
```

### Pins

#### `POST /api/pins/:sessionId`

Pin a session.

#### `DELETE /api/pins/:sessionId`

Unpin a session.

### Custom Tags

#### `POST /api/sessions/:id/tags`

Add custom tags to a session.

**Request Body:**
```typescript
{
  tags: string[];
}
```

#### `DELETE /api/sessions/:id/tags/:tag`

Remove a custom tag from a session.

## UI Components

### Sidebar

1. **Logo and Branding** - "AgentTrail" with custom icon
2. **Time Filters** - All, Today, This Week
3. **Tags Section** - Clickable tag filters with counts
4. **Directories Section** - Color-coded directory filters (collapsible)
5. **Projects Section** - Project list with session counts
6. **Settings Button** - Opens settings modal

### Main Content

#### List View

1. **Search Bar** - With quick/deep toggle
2. **Session List** - Cards grouped by directory
   - Pinned sessions appear first
   - Directory sections are collapsible
   - Session chains are grouped
   - Status indicators (working/awaiting)

#### Detail View

1. **Back Button** - Return to list
2. **Session Header** - Title, metadata, status
3. **Messages** - Scrollable message list
   - User messages (blue theme)
   - Assistant messages (purple theme)
   - Tool cards (collapsible)
   - Thinking blocks (expandable)
4. **Status Indicator** - Floating indicator for awaiting/working states

### Settings Modal

1. **Directories Tab**
   - List of configured directories
   - Add new directory button
   - Edit directory (path, label, color)
   - Enable/disable toggle
   - Remove directory

2. **General Tab**
   - Port configuration
   - Config file path (read-only)

## CLI Usage

```bash
# Start the server
agenttrail

# Start on custom port
agenttrail --port 8080
agenttrail -p 8080

# Run in daemon mode (background)
agenttrail --daemon
agenttrail -d

# Initialize config with default directory
agenttrail --init

# Show help
agenttrail --help
agenttrail -h

# Show version
agenttrail --version
agenttrail -v
```

### First Run

On first run, if no config exists:
1. Creates `~/.config/agenttrail/config.json`
2. Adds `~/.claude/projects` as the default directory
3. Starts the server

## File Structure

```
agenttrail/
├── package.json
├── tsconfig.json
├── SPEC.md
├── src/
│   ├── index.ts          # CLI entry point
│   ├── server.ts         # ElysiaJS routes
│   ├── config.ts         # Config management
│   ├── parser.ts         # JSONL parsing
│   ├── sessions.ts       # Session discovery
│   ├── tagger.ts         # Auto-tagging logic
│   ├── watcher.ts        # File watching
│   └── search.ts         # Search implementation
└── public/
    ├── index.html        # Main HTML
    ├── app.js            # Frontend JavaScript
    └── styles.css        # Styling
```

## Visual Design

### Color Palette (Dark Theme)

- **Background Primary**: `#0d1117`
- **Background Secondary**: `#161b22`
- **Background Tertiary**: `#21262d`
- **Border**: `#30363d`
- **Text Primary**: `#e6edf3`
- **Text Secondary**: `#8b949e`
- **Accent (AgentTrail)**: `#10b981` (Emerald green - distinguishes from Cloister's purple)
- **User Messages**: `#2563eb` (Blue)
- **Success**: `#238636`
- **Warning**: `#d29922`
- **Error**: `#f85149`

### Branding

- **Name**: AgentTrail
- **Icon**: Trail/path icon with multiple connected dots
- **Tagline**: "Track your Claude conversations across directories"

## Development

### Setup

```bash
# Clone and install
cd agenttrail
bun install

# Run in development mode (with hot reload)
bun run dev

# Build for distribution
bun run build
```

### Testing

```bash
# Run tests (future)
bun test
```
