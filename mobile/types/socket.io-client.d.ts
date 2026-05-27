declare module 'socket.io-client' {
  export function io(url: string, opts?: any): Socket;
  export interface Socket {
    id: string;
    connected: boolean;
    on(event: string, callback: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): this;
    off(event: string, callback?: (...args: any[]) => void): this;
    disconnect(): this;
    connect(): this;
    removeAllListeners(event?: string): this;
  }
}