import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Library } from './types';

export class GlobalStorage {
  private storageUri: vscode.Uri;
  private filePath: string;

  constructor(context: vscode.ExtensionContext) {
    this.storageUri = context.globalStorageUri;
    this.filePath = path.join(this.storageUri.fsPath, 'libraries.json');
    this.ensureStorageExists();
  }

  private ensureStorageExists() {
    if (!fs.existsSync(this.storageUri.fsPath)) {
      fs.mkdirSync(this.storageUri.fsPath, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      const initialLibs: Library[] = [];
      fs.writeFileSync(this.filePath, JSON.stringify(initialLibs, null, 2), 'utf8');
    }
  }

  public getLibraries(): Library[] {
    try {
      this.ensureStorageExists();
      const content = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(content) as Library[];
    } catch (error) {
      console.error('Error reading global libraries storage:', error);
      return [];
    }
  }

  public saveLibraries(libraries: Library[]): void {
    try {
      this.ensureStorageExists();
      fs.writeFileSync(this.filePath, JSON.stringify(libraries, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving global libraries storage:', error);
    }
  }

  public addLibrary(lib: Library): void {
    const libs = this.getLibraries();
    const index = libs.findIndex(l => l.id === lib.id);
    if (index >= 0) {
      libs[index] = lib;
    } else {
      libs.push(lib);
    }
    this.saveLibraries(libs);
  }

  public removeLibrary(id: string): void {
    const libs = this.getLibraries();
    const filtered = libs.filter(l => l.id !== id);
    this.saveLibraries(filtered);
  }

  public getRawContent(): string {
    try {
      this.ensureStorageExists();
      return fs.readFileSync(this.filePath, 'utf8');
    } catch {
      return '[]';
    }
  }

  public restoreRawContent(content: string): void {
    try {
      this.ensureStorageExists();
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        fs.writeFileSync(this.filePath, JSON.stringify(parsed, null, 2), 'utf8');
      } else {
        throw new Error('Content is not a valid JSON array');
      }
    } catch (error) {
      throw new Error(`Failed to restore content: ${(error as Error).message}`);
    }
  }
}
