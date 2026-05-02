export default function Loading() {
  return (
    <main className="protocol-loading-page" aria-label="Artist Arcade is loading">
      <section className="protocol-loading-card">
        <span className="protocol-mark-symbol">AA</span>
        <h1>Loading protocol</h1>
        <div className="protocol-loading-bar" aria-hidden="true">
          <span />
        </div>
        <p>Checking profile, wallet, arena state, submissions, judging assignments, and results.</p>
      </section>
    </main>
  );
}
