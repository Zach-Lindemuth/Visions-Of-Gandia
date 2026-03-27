import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

export default function PendingApproval() {
  return (
    <div className="page-center">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <ThemeToggle />
        </div>

        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <span style={{ fontSize: "3rem" }}>⏳</span>
        </div>

        <h1>Account Pending Approval</h1>

        <p style={{ marginBottom: "1rem", lineHeight: "1.6" }}>
          Thank you for registering! Your account has been created successfully,
          but it requires administrator approval before you can access the application.
        </p>

        <p style={{ marginBottom: "1.5rem", lineHeight: "1.6" }}>
          You'll be able to log in once an administrator has reviewed and approved
          your account. This usually doesn't take long.
        </p>

        <Link to="/login">
          <button type="button">Back to Login</button>
        </Link>
      </div>
    </div>
  );
}