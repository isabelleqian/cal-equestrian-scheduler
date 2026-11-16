export default function Setup() {
  return (
    <div className="page narrow">
      <div className="card">
        <h1>Almost there</h1>
        <p>
          The scheduler is online, but it is not connected to its database yet. The site needs two GitHub
          repository secrets, <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <ol>
          <li>Open your Supabase project, then Project Settings, then API (or Data API).</li>
          <li>Copy the Project URL and the anon public key.</li>
          <li>
            In GitHub, open the repo, then Settings, then Secrets and variables, then Actions, and add both secrets.
          </li>
          <li>Open the Actions tab, pick "Deploy to GitHub Pages", and click "Run workflow".</li>
        </ol>
        <p className="muted">The README in the repository walks through every step.</p>
      </div>
    </div>
  );
}
