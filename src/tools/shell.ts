import { exec, spawn } from 'child_process';
import chalk from 'chalk';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Shell command execution result
 */
export interface ShellResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode?: number;
  command: string;
}

/**
 * Safe shell command execution
 * Note: Be careful with user input to avoid command injection
 */
export class ShellTools {
  private workingDir: string;
  private blockedCommands: string[] = [
    'rm -rf /',
    'del /C',
    'format',
    'mkfs',
    'dd if=/dev/zero',
    'chmod -R 777 /',
    'chown -R',
  ];

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
  }

  /**
   * Execute a shell command safely
   */
  async execute(command: string, options?: {
    timeout?: number;
    cwd?: string;
    env?: Record<string, string>;
    streamOutput?: boolean;
  }): Promise<ShellResult> {
    const timeout = options?.timeout ?? 60000; // 1 minute default
    const cwd = options?.cwd ?? this.workingDir;

    // Security check
    if (this.isDangerousCommand(command)) {
      return {
        success: false,
        stdout: '',
        stderr: '❌ Dangerous command blocked for safety',
        command,
        exitCode: -1,
      };
    }

    console.log(chalk.gray(`$ ${command}`));

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        env: { ...process.env, ...options?.env },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (options?.streamOutput) {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
      }

      return {
        success: true,
        stdout,
        stderr,
        command,
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        command,
        exitCode: error.code || -1,
      };
    }
  }

  /**
   * Execute command with streaming output (for long-running commands)
   */
  executeStream(command: string, options?: {
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<ShellResult> {
    return new Promise((resolve) => {
      const cwd = options?.cwd ?? this.workingDir;
      
      if (this.isDangerousCommand(command)) {
        resolve({
          success: false,
          stdout: '',
          stderr: '❌ Dangerous command blocked for safety',
          command,
          exitCode: -1,
        });
        return;
      }

      console.log(chalk.gray(`$ ${command}`));

      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        cwd,
        env: { ...process.env, ...options?.env },
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        process.stdout.write(text);
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        process.stderr.write(text);
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          command,
          exitCode: code ?? -1,
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          stdout: '',
          stderr: error.message,
          command,
          exitCode: -1,
        });
      });
    });
  }

  /**
   * Check if a command is dangerous
   */
  private isDangerousCommand(command: string): boolean {
    const lowerCmd = command.toLowerCase();
    
    return this.blockedCommands.some(blocked => 
      lowerCmd.includes(blocked.toLowerCase())
    );
  }

  /**
   * Run npm/yarn/pnpm commands
   */
  async runPackageCommand(
    command: string,
    packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
  ): Promise<ShellResult> {
    return this.execute(`${packageManager} ${command}`);
  }

  /**
   * Run git commands
   */
  async runGitCommand(args: string): Promise<ShellResult> {
    return this.execute(`git ${args}`);
  }

  /**
   * Check if a command exists
   */
  async commandExists(command: string): Promise<boolean> {
    try {
      const checkCommand = process.platform === 'win32' 
        ? `where ${command}` 
        : `which ${command}`;
      
      const result = await execAsync(checkCommand);
      return result.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }
}
