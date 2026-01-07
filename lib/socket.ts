"use client";

import { io, Socket } from "socket.io-client";
import { useEffect, useRef, useCallback, useState } from "react";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:3001";

// Singleton socket instance
let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
  }
  return socket;
}

/**
 * Hook to use Socket.io for real-time POS sync
 */
export function usePOSSocket(outletId: string | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const hasJoinedRef = useRef(false);
  const prevOutletIdRef = useRef<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!outletId) return;

    const socket = getSocket();
    socketRef.current = socket;

    // Reset hasJoinedRef when outletId changes
    if (prevOutletIdRef.current !== outletId) {
      // Leave previous outlet room if we were in one
      if (prevOutletIdRef.current && hasJoinedRef.current) {
        socket.emit("leave:outlet", prevOutletIdRef.current);
        console.log(`[Socket] Left outlet: ${prevOutletIdRef.current}`);
      }
      hasJoinedRef.current = false;
      prevOutletIdRef.current = outletId;
    }

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    }

    // Named handlers for proper cleanup
    const handleConnect = () => {
      setIsConnected(true);
      if (outletId && !hasJoinedRef.current) {
        socket.emit("join:outlet", outletId);
        hasJoinedRef.current = true;
        console.log(`[Socket] Connected and joined outlet: ${outletId}`);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      hasJoinedRef.current = false;
      console.log("[Socket] Disconnected");
    };

    // If already connected, join immediately
    if (socket.connected && !hasJoinedRef.current) {
      setIsConnected(true);
      socket.emit("join:outlet", outletId);
      hasJoinedRef.current = true;
      console.log(`[Socket] Already connected, joined outlet: ${outletId}`);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      hasJoinedRef.current = false;
      // Don't disconnect - keep connection alive for other components
    };
  }, [outletId]);

  // Emit table update
  const emitTableUpdate = useCallback((tableId: string, status: string, orderId?: string) => {
    if (socketRef.current?.connected && outletId) {
      socketRef.current.emit("table:update", {
        outletId,
        tableId,
        status,
        orderId,
      });
    }
  }, [outletId]);

  // Emit order update
  const emitOrderUpdate = useCallback((orderId: string, action: string, orderData?: any) => {
    if (socketRef.current?.connected && outletId) {
      socketRef.current.emit("order:update", {
        outletId,
        orderId,
        action,
        orderData,
      });
    }
  }, [outletId]);

  // Request all clients to refresh tables
  const emitTablesRefresh = useCallback(() => {
    if (socketRef.current?.connected && outletId) {
      socketRef.current.emit("tables:refresh", { outletId });
    }
  }, [outletId]);

  // Subscribe to table updates
  const onTableUpdate = useCallback((callback: (data: { tableId: string; status: string; orderId?: string }) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};

    socket.on("table:updated", callback);
    return () => socket.off("table:updated", callback);
  }, []);

  // Subscribe to order updates
  const onOrderUpdate = useCallback((callback: (data: { orderId: string; action: string; orderData?: any }) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};

    socket.on("order:updated", callback);
    return () => socket.off("order:updated", callback);
  }, []);

  // Subscribe to refresh all command
  const onTablesRefreshAll = useCallback((callback: () => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};

    socket.on("tables:refresh-all", callback);
    return () => socket.off("tables:refresh-all", callback);
  }, []);

  return {
    isConnected,
    emitTableUpdate,
    emitOrderUpdate,
    emitTablesRefresh,
    onTableUpdate,
    onOrderUpdate,
    onTablesRefreshAll,
  };
}

/**
 * Hook to use Socket.io for real-time booking payment updates
 */
export function useBookingSocket(bookingId: string | undefined) {
  const socketRef = useRef<Socket | null>(null);
  const hasJoinedRef = useRef(false);
  const prevBookingIdRef = useRef<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!bookingId) return;

    const socket = getSocket();
    socketRef.current = socket;

    // Reset hasJoinedRef when bookingId changes
    if (prevBookingIdRef.current !== bookingId) {
      // Leave previous booking room if we were in one
      if (prevBookingIdRef.current && hasJoinedRef.current) {
        socket.emit("leave:booking", prevBookingIdRef.current);
        console.log(`[Socket] Left booking: ${prevBookingIdRef.current}`);
      }
      hasJoinedRef.current = false;
      prevBookingIdRef.current = bookingId;
    }

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    }

    // Named handlers for proper cleanup
    const handleConnect = () => {
      setIsConnected(true);
      if (bookingId && !hasJoinedRef.current) {
        socket.emit("join:booking", bookingId);
        hasJoinedRef.current = true;
        console.log(`[Socket] Connected and joined booking: ${bookingId}`);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      hasJoinedRef.current = false;
      console.log("[Socket] Disconnected from booking");
    };

    // If already connected, join immediately
    if (socket.connected && !hasJoinedRef.current) {
      setIsConnected(true);
      socket.emit("join:booking", bookingId);
      hasJoinedRef.current = true;
      console.log(`[Socket] Already connected, joined booking: ${bookingId}`);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      hasJoinedRef.current = false;
    };
  }, [bookingId]);

  // Subscribe to booking updates
  const onBookingUpdate = useCallback((callback: (data: { bookingId: string; status: string; paymentStatus: string }) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};

    socket.on("booking:updated", callback);
    return () => socket.off("booking:updated", callback);
  }, []);

  return {
    isConnected,
    onBookingUpdate,
  };
}
