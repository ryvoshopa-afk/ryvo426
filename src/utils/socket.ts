import { io, Socket } from "socket.io-client";

// Connect to the API server origin dynamically supporting Next.js and Vite env prefixes
const getApiUrl = () => {
  const meta = import.meta as any;
  
  // 1. Check explicit environment variables first
  const envUrl = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) || 
                 (meta.env && (meta.env.VITE_API_URL || meta.env.NEXT_PUBLIC_API_URL)) || '';
  if (envUrl) return envUrl.replace(/\/$/, '');
  
  // 2. Fallback to smart detection based on current window domain
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    
    // If we are in local development, use localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    
    // If we are on Vercel or the production custom domain, point directly to the persistent Render backend
    if (hostname.includes('ryvo.shop') || hostname.includes('vercel.app')) {
      return 'https://ryvo-backend-hiw4.onrender.com';
    }
    
    // Otherwise fallback to the current host origin (for local previews/dev server)
    return origin;
  }
  
  return 'http://localhost:3000';
};

const socketUrl = getApiUrl();

export const socket: Socket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
export default socket;
