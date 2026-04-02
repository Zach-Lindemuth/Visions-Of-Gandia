import NavBar from "../components/NavBar";
import RoomSidebar from "../components/RoomSidebar";
import { useRoom } from "../context/RoomContext";

export default function AppLayout({ children }) {
  const { room } = useRoom();

  return (
    <>
      <NavBar />
      <div className={`app-layout ${room ? "app-layout-room" : ""}`}>
        <main className="app-content">
          {children}
        </main>
        <RoomSidebar />
      </div>
    </>
  );
}
