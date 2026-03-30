import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

/**
 * File operation result
 */
export interface FileOperationResult {
  success: boolean;
  content?: string;
  error?: string;
  path?: string;
}

/**
 * Search result in file
 */
export interface SearchResult {
  file: string;
  line: number;
  content: string;
  match: string;
}

/**
 * File system tools for vibe coding
 */
export class FileSystemTools {
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  /**
   * Read a file's contents
   */
  async readFile(filePath: string, options?: { maxLines?: number }): Promise<FileOperationResult> {
    try {
      const absolutePath = this.resolvePath(filePath);
      
      if (!fs.existsSync(absolutePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      let content = fs.readFileSync(absolutePath, 'utf-8');
      
      if (options?.maxLines) {
        const lines = content.split('\n');
        if (lines.length > options.maxLines) {
          content = lines.slice(0, options.maxLines).join('\n') + `\n\n... (${lines.length - options.maxLines} more lines)`;
        }
      }

      console.log(chalk.gray(`📄 Read: ${filePath}`));
      return { success: true, content, path: absolutePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Write content to a file (creates if doesn't exist)
   */
  async writeFile(filePath: string, content: string): Promise<FileOperationResult> {
    try {
      const absolutePath = this.resolvePath(filePath);
      
      // Create directory if it doesn't exist
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(absolutePath, content, 'utf-8');
      
      console.log(chalk.green(`✏️ Wrote: ${filePath}`));
      return { success: true, path: absolutePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Edit a file by replacing old_string with new_string
   */
  async editFile(
    filePath: string,
    oldString: string,
    newString: string
  ): Promise<FileOperationResult> {
    try {
      const absolutePath = this.resolvePath(filePath);
      
      if (!fs.existsSync(absolutePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      const content = fs.readFileSync(absolutePath, 'utf-8');
      
      if (!content.includes(oldString)) {
        return { 
          success: false, 
          error: 'Old string not found in file. Make sure the text matches exactly.' 
        };
      }

      const newContent = content.replace(oldString, newString);
      fs.writeFileSync(absolutePath, newContent, 'utf-8');
      
      console.log(chalk.green(`✏️ Edited: ${filePath}`));
      return { success: true, path: absolutePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new file
   */
  async createFile(filePath: string, content: string = ''): Promise<FileOperationResult> {
    return this.writeFile(filePath, content);
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<FileOperationResult> {
    try {
      const absolutePath = this.resolvePath(filePath);
      
      if (!fs.existsSync(absolutePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      fs.unlinkSync(absolutePath);
      
      console.log(chalk.red(`🗑️ Deleted: ${filePath}`));
      return { success: true, path: absolutePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Search for a pattern in files (like grep)
   */
  async searchInFiles(
    pattern: string | RegExp,
    options?: { 
      include?: string[]; 
      exclude?: string[];
      maxResults?: number;
    }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const maxResults = options?.maxResults ?? 100;
    const include = options?.include || ['**/*'];
    const exclude = options?.exclude || ['node_modules', 'dist', '.git', '*.log'];

    const files = this.globFiles(include, exclude);
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern, 'gi') 
      : pattern;

    for (const file of files) {
      if (results.length >= maxResults) break;

      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = line.match(regex);
          
          if (match) {
            results.push({
              file: path.relative(this.rootDir, file),
              line: i + 1,
              content: line.trim(),
              match: match[0],
            });

            if (results.length >= maxResults) break;
          }
        }
      } catch {
        // Skip binary files
      }
    }

    console.log(chalk.gray(`🔍 Found ${results.length} matches for: ${pattern}`));
    return results;
  }

  /**
   * List files matching patterns
   */
  globFiles(include: string[] = ['**/*'], exclude: string[] = []): string[] {
    const files: string[] = [];
    
    const walkDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.rootDir, fullPath);

          // Check exclusions
          if (exclude.some(ex => relativePath.includes(ex) || entry.name.includes(ex))) {
            continue;
          }

          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else {
            // Check inclusions
            if (include.length === 0 || include.some(pat => {
              if (pat === '**/*') return true;
              if (pat.startsWith('*')) return entry.name.endsWith(pat.slice(1));
              if (pat.endsWith('*')) return entry.name.startsWith(pat.slice(0, -1));
              return relativePath.includes(pat);
            })) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    walkDir(this.rootDir);
    return files;
  }

  /**
   * Get file info
   */
  async getFileInfo(filePath: string): Promise<{ exists: boolean; size?: number; lines?: number } | null> {
    try {
      const absolutePath = this.resolvePath(filePath);
      
      if (!fs.existsSync(absolutePath)) {
        return { exists: false };
      }

      const stats = fs.statSync(absolutePath);
      const content = fs.readFileSync(absolutePath, 'utf-8');
      
      return {
        exists: true,
        size: stats.size,
        lines: content.split('\n').length,
      };
    } catch {
      return null;
    }
  }

  /**
   * Resolve path relative to root directory
   */
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.rootDir, filePath);
  }
}
