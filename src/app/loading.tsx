import Image from "next/image";

export default function Loading() {
  return (
    <main className="loading-page" aria-label="The Artist Arcade is loading">
      <div className="loading-field" aria-hidden="true">
        <span className="loading-vignette" />
        <span className="loading-orbit loading-orbit-one" />
        <span className="loading-orbit loading-orbit-two" />
        <span className="loading-wave" />
        <span className="loading-sparks loading-sparks-one" />
        <span className="loading-sparks loading-sparks-two" />
      </div>

      <section className="loading-stage">
        <span className="loading-corner-mark">8</span>
        <div className="loading-logo-wrap">
          <Image
            alt="The Artist Arcade"
            className="loading-logo"
            height={1024}
            priority
            src="/brand/artist-arcade-primary.jpg"
            width={1024}
          />
        </div>

        <div className="loading-status">
          <strong>Loading</strong>
          <div className="loading-bar" aria-hidden="true">
            <span />
          </div>
          <p>&quot;Every bar. Every beat. Every decision. That is how legends are built.&quot;</p>
          <span>The code of the arena</span>
        </div>
      </section>
    </main>
  );
}
