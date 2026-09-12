import UploadPanel from "@/components/UploadPanel";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-ink">
      <section className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-6 pb-16 pt-20 sm:px-8">
        <span className="font-mono text-xs text-slate">CASE FILE — CONTENT AUTHENTICITY</span>
        <h1 className="font-serif text-4xl leading-tight text-paper sm:text-5xl">
          Before you trust it, check it.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-slate">
          Veritas runs a small set of forensic checks on an image or a passage of
          text — error-level analysis, metadata inspection, and stylometric
          signals — and shows you exactly what it found. No black box, no single
          verdict handed down without evidence.
        </p>
      </section>

      <section className="mx-auto flex max-w-3xl flex-col items-center gap-10 border-t border-inkline px-6 pb-24 pt-12 sm:px-8">
        <UploadPanel />
      </section>

      <footer className="border-t border-inkline px-6 py-8 text-center text-xs text-slate sm:px-8">
        Every check here is a probabilistic signal, not a certificate. Read the
        evidence, not just the score.
      </footer>
    </main>
  );
}
