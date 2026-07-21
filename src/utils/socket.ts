import { io, Socket } from "socket.io-client";

// Connect to the API server origin dynamically supporting Next.js and Vite env prefixes
const getApiUrl = () => {
  const meta = import.meta as any;
  const envUrl = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) || (meta.env && (meta.env.VITE_API_URL || meta.env.NEXT_PUBLIC_API_URL)) || '';
  if (envUrl) return envUrl.replace(/\/$/, '');
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
};

const socketUrl = getApiUrl();

export const socket: Socket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
export default socket;
