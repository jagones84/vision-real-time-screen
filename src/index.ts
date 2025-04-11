#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path'; // Use namespace import
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// --- Process Management ---
interface ManagedProcess {
  process: ChildProcess;
  command: string;
  cwd: string;
  stdoutBuffer: string[];
  stderrBuffer: string[];
  startTime: number;
  status: 'running' | 'exited' | 'error';
  exitCode: number | null;
}

// In-memory store for running processes, keyed by UUID
const runningProcesses: Map<string, ManagedProcess> = new Map();

// --- MCP Server Implementation ---
class ProcessManagerServer {
  server;

  constructor() {
    console.error("ProcessManagerServer: Constructor started."); // Log added previously
    this.server = new Server(
      {
        // Use the name provided during setup
        name: 'vision-real-time-screen', // Standardized name
        version: '0.1.0', // Restore original version
        description: 'Manages and monitors background processes, capturing their output.',
      },
      {
        capabilities: { resources: {}, tools: {} },
      }
    );
    this.setupToolHandlers(); // Restore tool handler setup
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error); // Add Error type
    process.on('SIGINT', async () => {
      // Attempt to clean up running processes on exit
      console.error('Shutting down, terminating managed processes...');
      runningProcesses.forEach((managedProcess, id) => {
        try {
          if (managedProcess.status === 'running') {
            managedProcess.process.kill('SIGTERM'); // Send SIGTERM first
            console.error(`Sent SIGTERM to process ${id}`);
          }
        } catch (e) {
          console.error(`Error terminating process ${id}:`, e);
        }
      });
      await this.server.close();
      process.exit(0);
    });
    console.error("ProcessManagerServer: Constructor finished."); // Log added previously
  }

  // Restore Tool Handlers
  async setupToolHandlers() {
    console.error("ProcessManagerServer: setupToolHandlers started.");
    // List Tools
    try {
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        // Removed console.error log from inside the handler
        return {
      tools: [
        {
          name: 'start_process',
          description: 'Starts a background command asynchronously and returns a process ID for monitoring. Example Usage: 1. Activate the virtual environment (if necessary): `C:\\PYTHON\\pdf_bot_env\\Scripts\\activate` 2. Run the script with UTF-8 encoding: `set PYTHONIOENCODING=utf-8 && call C:\\PYTHON\\pdf_bot_env\\Scripts\\activate && python C:\\PYTHON\\USER_SCRIPTS\\AGENTS\\AGENTIC_CHATBOT\\tests\\TOOLS\\TEST_TOOL_DEEP_CLINE.py` 3. Monitor the process: Use the `get_process_output` tool with the process ID to get the output and generate a summary.',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The command line string to execute (e.g., "python script.py -arg value").',
              },
              cwd: {
                type: 'string',
                description: 'Optional working directory for the command. Defaults to the system\'s default.',
              },
            },
            required: ['command'],
          },
        },
		{
          name: 'take_screenshot',
          description: 'Takes a screenshot of the screen and saves it to a file.',
          inputSchema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Optional filename for the screenshot. If not provided, a default filename will be used.',
              },
            },
          },
        },
        {
          name: 'get_process_output',
          description: 'Retrieves the latest stdout and stderr output from a running process, along with its current status.',
          inputSchema: {
            type: 'object',
            properties: {
              processId: {
                type: 'string',
                description: 'The UUID of the process to query.',
              },
              lines_since_last_call: { // Optional parameter to control output amount (though implementation will return all new)
                type: 'number',
                description: 'Optional hint for how many lines might be expected (implementation returns all new output).',
                default: 100,
              },
            },
            required: ['processId'],
          },
        },
        {
          name: 'stop_process',
          description: 'Attempts to terminate a running process gracefully (SIGTERM), then forcefully if necessary (SIGKILL).',
          inputSchema: {
            type: 'object',
            properties: {
              processId: {
                type: 'string',
                description: 'The UUID of the process to stop.',
              },
            },
            required: ['processId'],
          },
        },
      ], // Close tools array - Corrected placement
        }; // Close return object
      }); // Close setRequestHandler
      console.error("ProcessManagerServer: Registered ListToolsRequestSchema handler."); // Added log
    } catch (e: unknown) {
      console.error("ProcessManagerServer: FAILED to register ListToolsRequestSchema handler:", e);
    }

    // Call Tool
    // Remove incorrect manual type for request - let SDK infer
    try {
      this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        console.error(`ProcessManagerServer: Handling CallToolRequestSchema for tool: ${request.params.name}`);
        const toolName = request.params.name;
      const args = request.params.arguments;

      try {
        if (toolName === 'start_process') {
          return this.handleStartProcess(args);
        } else if (toolName === 'get_process_output') {
          return this.handleGetProcessOutput(args);
        } else if (toolName === 'stop_process') {
          return this.handleStopProcess(args);
		} else if (toolName === 'take_screenshot') {
			return this.handleTakeScreenshot(args);
        } else {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
        }
      } catch (error: unknown) { // Add unknown type
        console.error(`Error executing tool ${toolName}:`, error);
        // Add type checks for error
        const errorMessage = error instanceof McpError
          ? error.message
          : error instanceof Error
          ? error.message
          : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    });
      console.error("ProcessManagerServer: Registered CallToolRequestSchema handler."); // Added log
    } catch (e: unknown) {
      console.error("ProcessManagerServer: FAILED to register CallToolRequestSchema handler:", e);
    }
    console.error("ProcessManagerServer: setupToolHandlers finished.");
  }

  // Restore Tool Handler Implementations
  handleStartProcess(args: any) {
    if (!args || typeof args.command !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid "command" argument.');
    }
    if (args.cwd !== undefined && typeof args.cwd !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid "cwd" argument, must be a string.');
    }

    const commandString = `set PYTHONIOENCODING=utf-8 && ${args.command}`;
    const cwd = args.cwd || process.cwd(); // Use provided CWD or default
    const processId = uuidv4();

    console.error(`Starting process ${processId}: Command='${commandString}', CWD='${cwd}'`);

    try {
      // Basic command parsing (split by space, handle simple quotes later if needed)
      // WARNING: This is basic and won't handle complex shell syntax.
      // For robustness, consider using a library or requiring pre-split args.
      const parts = commandString.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      const commandExecutable = parts[0];
      const commandArgs = parts.slice(1).map((arg: string) => arg.replace(/^["']|["']$/g, '')); // Add string type to arg

      if (!commandExecutable) {
         throw new Error("Command string appears empty or invalid.");
      }

      const child = spawn(commandExecutable, commandArgs, {
        cwd: cwd,
        shell: true, // Use shell to handle complex commands, redirects, etc. Be cautious with untrusted input.
        stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdout/stderr
        detached: false, // Keep child attached unless specifically needed otherwise
      });

      const managedProcess: ManagedProcess = {
        process: child,
        command: commandString,
        cwd: cwd,
        stdoutBuffer: [],
        stderrBuffer: [],
        startTime: Date.now(),
        status: 'running',
        exitCode: null,
      };

      runningProcesses.set(processId, managedProcess);

      child.stdout.on('data', (data) => {
        const output = data.toString();
        managedProcess.stdoutBuffer.push(output);
        // Optional: Limit buffer size if memory is a concern
        // console.log(`[${processId} STDOUT] ${output.trim()}`); // Log for debugging
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        managedProcess.stderrBuffer.push(output);
        // console.error(`[${processId} STDERR] ${output.trim()}`); // Log for debugging
      });

      child.on('error', (err) => {
        console.error(`Process ${processId} error event:`, err);
        managedProcess.status = 'error';
        managedProcess.stderrBuffer.push(`\n[MCP Server Error] Failed to start process: ${err.message}\n`);
        runningProcesses.set(processId, managedProcess); // Update status in map
      });

      child.on('close', (code, signal) => {
        console.error(`Process ${processId} closed with code ${code}, signal ${signal}`);
        managedProcess.status = 'exited';
        managedProcess.exitCode = code;
        // Add exit information to stderr buffer for retrieval
        managedProcess.stderrBuffer.push(`\n[MCP Server Info] Process exited with code ${code} (signal: ${signal})\n`);
        runningProcesses.set(processId, managedProcess); // Update status in map
      });

      return {
        content: [{ type: 'text', text: JSON.stringify({ processId: processId, status: 'started' }) }],
      };

    } catch (error: unknown) { // Add unknown type
      console.error(`Failed to spawn process ${processId}:`, error);
      // Add type check for error
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Failed to start process: ${errorMessage}`);
    }
  }

  handleGetProcessOutput(args: any) {
    if (!args || typeof args.processId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid "processId" argument.');
    }

    const processId = args.processId;
    const managedProcess = runningProcesses.get(processId);

    if (!managedProcess) {
      // Use InvalidRequest when the specific ID is not found
      throw new McpError(ErrorCode.InvalidRequest, `Process with ID ${processId} not found or already completed.`);
    }

    // Get current buffered output
    const stdout = managedProcess.stdoutBuffer.join('');
    const stderr = managedProcess.stderrBuffer.join('');

    // Clear buffers for next call
    managedProcess.stdoutBuffer = [];
    managedProcess.stderrBuffer = [];

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          processId: processId,
          status: managedProcess.status,
          exitCode: managedProcess.exitCode,
          stdout: stdout,
          stderr: stderr,
        }),
      }],
    };
  }

  handleStopProcess(args: any) {
    if (!args || typeof args.processId !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid "processId" argument.');
    }

    const processId = args.processId;
    const managedProcess = runningProcesses.get(processId);

    if (!managedProcess) {
      // If not found, it's effectively stopped from our perspective
      console.warn(`Stop request for non-existent process ID: ${processId}`);
      return {
        content: [{ type: 'text', text: JSON.stringify({ processId: processId, status: 'not_found' }) }],
      };
    }

    if (managedProcess.status !== 'running') {
      // Already exited or errored out
      console.log(`Stop request for already stopped process ID: ${processId} (Status: ${managedProcess.status})`);
      return {
        content: [{ type: 'text', text: JSON.stringify({ processId: processId, status: 'already_stopped', finalStatus: managedProcess.status }) }],
      };
    }

    try {
      console.log(`Attempting to stop process ${processId} with SIGTERM...`);
      // Attempt graceful termination first
      const killed = managedProcess.process.kill('SIGTERM');

      if (killed) {
        // Note: Status update happens in the 'close' event handler added in handleStartProcess
        console.log(`SIGTERM sent successfully to process ${processId}.`);
        // We don't immediately know if it exited, the 'close' event handles the final status update.
        // We can return an intermediate status here.
        return {
          content: [{ type: 'text', text: JSON.stringify({ processId: processId, status: 'termination_signal_sent' }) }],
        };
      } else {
        console.error(`Failed to send SIGTERM to process ${processId}. It might have already exited.`);
        // If sending signal failed, it likely already exited between check and kill attempt
        managedProcess.status = 'exited'; // Update status proactively
        runningProcesses.set(processId, managedProcess);
        return {
          content: [{ type: 'text', text: JSON.stringify({ processId: processId, status: 'already_stopped', finalStatus: 'exited' }) }],
        };
      }
      // TODO: Consider adding SIGKILL after a timeout if SIGTERM fails, but keep it simple for now.

    } catch (error) {
      console.error(`Error stopping process ${processId}:`, error);
      // Update status to error if stopping failed unexpectedly
      managedProcess.status = 'error';
      runningProcesses.set(processId, managedProcess);
      throw new McpError(ErrorCode.InternalError, `Failed to stop process: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async handleTakeScreenshot(args: any) {
	  const filename = args?.filename ? String(args.filename) : `screenshot-${uuidv4()}.png`;
      try {
        const img = await screenshot();
        const buffer = sharp(img as any)
          .png()
          .toBuffer();

        const finalBuffer = await buffer;
        await fs.writeFile(filename, finalBuffer);

        return {
          content: [{
            type: 'text',
            text: `Screenshot saved to ${filename}`,
          }],
        };
      } catch (error) {
        console.error("Screenshot error:", error);
        return {
          content: [{
            type: 'text',
            text: `Error taking screenshot: ${String(error)}`
          }],
          isError: true
        };
      }
  }

  // --- Server Start ---
  async run() {
    console.error("ProcessManagerServer: Run method started."); // Log added previously
    const transport = new StdioServerTransport();
    console.error("ProcessManagerServer: StdioServerTransport created."); // Log added previously
    try {
      await this.server.connect(transport);
      console.error('Process Manager MCP server successfully connected on stdio'); // Updated log
    } catch (connectError: unknown) {
      console.error('Process Manager MCP server FAILED to connect:', connectError); // Added catch block
      // Optionally re-throw or exit if connection is critical
      process.exit(1); // Exit if connection fails
    }
  }
}

console.error("Minimal server script: Instantiating ProcessManagerServer..."); // Log added previously
const server = new ProcessManagerServer();
console.error("Minimal server script: Calling server.run()..."); // Log added previously
server.run().catch(error => { // Catch errors during run()
    console.error("Minimal server script: server.run() failed:", error);
    process.exit(1);
});
console.error("Minimal server script: End of script reached (after run call)."); // Log added previously
