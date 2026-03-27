import { Link } from "react-router-dom";

export default function CreateCharacter() {
  return (
    <div className="page-center">
      <div className="card">
        <h1>Create Character</h1>

        <p>
          Character creation will live here.
          <br />
          This page is under construction.
        </p>

        <Link to="/">← Back to Characters</Link>
      </div>
    </div>
  );
}
