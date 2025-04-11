# vision-real-time-screen
MCP tool (for AI models and valid for VScode, Roo, Cline) for auto terminal output detection and screenshots 

## Overview

This project provides tools to interact with the screen in real-time, including taking screenshots and monitoring process output. It's designed to be used as an MCP server, providing tools that can be accessed and used by other applications.

## Available Tools

*   **start\_process:** Starts a background command asynchronously and returns a process ID for monitoring.
*   **take\_screenshot:** Takes a screenshot of the screen and saves it to a file.
*   **get\_process\_output:** Retrieves the latest stdout and stderr output from a running process, along with its current status.
*   **stop\_process:** Attempts to terminate a running process gracefully (SIGTERM), then forcefully if necessary (SIGKILL).

## Usage

To use this project as an MCP server, you need to:

1.  Install the dependencies: `npm install`
2.  Start the server: `node index.js`

To enable this MCP server, you need to add the following configuration to your `mcp_settings.json` file (typically located at `C:\Users\giova\AppData\Roaming\Code - Insiders\User\globalStorage\rooveterinaryinc.roo-cline\settings\mcp_settings.json`):

```json
{
  "vision-real-time-screen": {
    "alwaysAllow": [
      "start_process",
      "take_screenshot",
      "get_process_output",
      "stop_process"
    ],
    "disabled": false,
    "timeout": 60,
    "command": "node",
    "args": [
      "C:\\Users\\giova\\OneDrive\\Documents\\Cline\\MCP\\vision real time screen\\build\\index.js"
    ],
    "env": {},
    "transportType": "stdio"
  }
}
```

Ensure that the `command` and `args` paths are correct for your system.

Once the server is running, other applications can access the tools it provides through the MCP protocol.

## Configuration

The server can be configured using environment variables or a configuration file. See the documentation for more details.

## Contributing

Contributions are welcome! Please submit a pull request with your changes.

## License

[Specify the license here]
