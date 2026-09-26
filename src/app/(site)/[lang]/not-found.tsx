import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wrap" style={{ padding: '120px 0', minHeight: '70vh' }}>
      <h1 className="display" style={{ fontSize: 'clamp(48px, 10vw, 104px)', color: 'var(--teal)' }}>
        Off the track.
      </h1>
      <p style={{ margin: '24px 0 32px', fontSize: 18, color: 'var(--muted)' }}>
        That page does not exist. It may have moved, or the link has a typo.
      </p>
      <Link className="btn btn-flame" href="/en">
        Go to the home page
      </Link>
    </main>
  );
}
