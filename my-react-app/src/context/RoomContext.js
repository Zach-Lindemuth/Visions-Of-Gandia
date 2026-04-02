import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "../auth/AuthContext";

const HUB_URL = process.env.REACT_APP_HUB_BASE_URL + "/room";

const RoomContext = createContext(null);

export function RoomProvider({ children }) {
  const { auth } = useAuth();
  const [room, setRoom] = useState(null); // { roomId, ownerId, members: [RoomCharacterCard] }
  const [changedCharacterId, setChangedCharacterId] = useState(null);
  const connectionRef = useRef(null);
  const authRef = useRef(auth);
  authRef.current = auth;

  const isOwner = room != null && room.ownerId === auth?.userId;

  // Build and start a hub connection
  const getConnection = useCallback(() => {
    if (connectionRef.current) return connectionRef.current;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => authRef.current?.token ?? "",
      })
      .withAutomaticReconnect()
      .build();

    conn.on("RoomCreated", (roomId, card) => {
      setRoom({ roomId, ownerId: card.ownerUserId, members: [card] });
    });

    conn.on("RoomJoined", (roomId, ownerId, cards) => {
      setRoom({ roomId, ownerId, members: cards });
    });

    conn.on("PlayerJoined", (card) => {
      setRoom((prev) => prev ? { ...prev, members: [...prev.members, card] } : prev);
    });

    conn.on("PlayerLeft", (characterId) => {
      setRoom((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.characterId !== characterId) } : prev
      );
    });

    conn.on("RoomClosed", () => {
      setRoom(null);
    });

    conn.on("CharacterChanged", (characterId) => {
      setChangedCharacterId(characterId);
    });

    conn.on("VitalsUpdated", (updatedCard) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.characterId === updatedCard.characterId ? updatedCard : m
          ),
        };
      });
    });

    conn.on("Error", (message) => {
      console.error("RoomHub error:", message);
    });

    connectionRef.current = conn;
    return conn;
  }, []);

  // Cleanup connection when auth is lost
  useEffect(() => {
    if (!auth) {
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
      setRoom(null);
    }
  }, [auth]);

  const createRoom = useCallback(async (characterId) => {
    const conn = getConnection();
    if (conn.state === signalR.HubConnectionState.Disconnected) {
      await conn.start();
    }
    await conn.invoke("CreateRoom", characterId);
  }, [getConnection]);

  const joinRoom = useCallback(async (roomId, characterId) => {
    const conn = getConnection();
    if (conn.state === signalR.HubConnectionState.Disconnected) {
      await conn.start();
    }
    await conn.invoke("JoinRoom", roomId, characterId);
  }, [getConnection]);

  const leaveRoom = useCallback(async () => {
    if (!connectionRef.current) return;
    try {
      await connectionRef.current.invoke("LeaveRoom");
    } catch {
      // best-effort
    }
    await connectionRef.current.stop();
    connectionRef.current = null;
    setRoom(null);
  }, []);

  const clearChangedCharacter = useCallback(() => setChangedCharacterId(null), []);

  return (
    <RoomContext.Provider value={{ room, isOwner, createRoom, joinRoom, leaveRoom, changedCharacterId, clearChangedCharacter }}>
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom() {
  return useContext(RoomContext);
}
