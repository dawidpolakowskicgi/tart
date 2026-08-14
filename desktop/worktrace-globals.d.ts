export {};

declare global {
  interface Window {
    worktrace: WorktraceDesktopApi;
  }
}

interface WorktraceDesktopApi {
  addEntry(message: string, time?: string, date?: string): Promise<unknown>;
  cloneEntry(ref: string, line: string): Promise<unknown>;
  closeWindow(): Promise<unknown>;
  copyText(text: string): Promise<unknown>;
  deleteEntry(ref: string, line: string): Promise<unknown>;
  editEntry(ref: string, line: string, date: string, time: string, message: string): Promise<unknown>;
  exportWeek(format: string): Promise<unknown>;
  fitWindowHeight(height: number): Promise<unknown>;
  getState(ref?: string): Promise<unknown>;
  maximizeWindow(): Promise<unknown>;
  minimizeWindow(): Promise<unknown>;
  openLogDir(): Promise<unknown>;
  saveWeek(text: string): Promise<unknown>;
}
