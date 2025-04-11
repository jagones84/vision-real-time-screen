# vision-real-time-screen
MCP tool (for AI models and valid for VScode, Roo, Cline) for auto terminal output detection and screenshots 

## Overview

This project provides tools to interact with the screen in real-time, including taking screenshots and monitoring process output. It's designed to be used as an MCP server, providing tools that can be accessed and used by other applications.

## Requirements

*   **Node.js:** This project requires Node.js to be installed. You can download it from [https://nodejs.org/](https://nodejs.org/).

## Available Tools

*   **start\_process:** Starts a background command asynchronously and returns a process ID for monitoring.
*   **take\_screenshot:** Takes a screenshot of the screen and saves it to a file.
*   **get\_process\_output:** Retrieves the latest stdout and stderr output from a running process, along with its current status.
*   **stop\_process:** Attempts to terminate a running process gracefully (SIGTERM), then forcefully if necessary (SIGKILL).

## Usage

To use this project as an MCP server, you need to:

1.  **Install Node.js:** Ensure that Node.js is installed on your system.
2.  **Install the dependencies:** Navigate to the project directory in your terminal and run `npm install`.  **Note:** Do not include the `node_modules` folder in your repository. These dependencies will be installed when the project is set up.
3.  **Start the server:** Run `node index.js` to start the server.

To enable this MCP server, you need to add the following configuration to your `mcp_settings.json` file (typically located at `C:\Users\[Your Username]\AppData\Roaming\Code - Insiders\User\globalStorage\rooveterinaryinc.roo-cline\settings\mcp_settings.json`):

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
      "C:\\Users\\[Your Username]\\OneDrive\\Documents\\Cline\\MCP\\vision real time screen\\build\\index.js"
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
