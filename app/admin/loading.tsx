import TopRouteLoader from "@/components/TopRouteLoader";

export default function AdminLoading() {
  return (
    <>
      <TopRouteLoader />
      <div className="admin-route-loading" role="status" aria-label="Loading dashboard page">
        <aside className="admin-route-loading__sidebar" aria-hidden="true">
          <div className="admin-route-loading__logo" />
          <div className="admin-route-loading__nav">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="admin-route-loading__nav-item" key={index} />
            ))}
          </div>
        </aside>

        <div className="admin-route-loading__page" aria-hidden="true">
          <header className="admin-route-loading__header">
            <div className="admin-route-loading__line admin-route-loading__line--title" />
            <div className="admin-route-loading__user" />
          </header>
          <main className="admin-route-loading__main">
            <div className="admin-route-loading__line admin-route-loading__line--heading" />
            <div className="admin-route-loading__cards">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="admin-route-loading__card" key={index} />
              ))}
            </div>
            <div className="admin-route-loading__panel" />
          </main>
        </div>
      </div>

      <style>{`
        .admin-route-loading {
          min-height: 100vh;
          background: #f5f6fa;
        }
        .admin-route-loading__sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 220px;
          padding: 22px 18px;
          background: #fff;
          border-right: 1px solid #e5e7eb;
        }
        .admin-route-loading__logo,
        .admin-route-loading__nav-item,
        .admin-route-loading__line,
        .admin-route-loading__user,
        .admin-route-loading__card,
        .admin-route-loading__panel {
          overflow: hidden;
          position: relative;
          background: #e9ebef;
        }
        .admin-route-loading__logo {
          width: 118px;
          height: 30px;
          margin: 0 auto 34px;
          border-radius: 8px;
        }
        .admin-route-loading__nav { display: grid; gap: 11px; }
        .admin-route-loading__nav-item { height: 38px; border-radius: 9px; }
        .admin-route-loading__page { margin-left: 220px; min-height: 100vh; }
        .admin-route-loading__header {
          height: 60px;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
        }
        .admin-route-loading__line--title { width: 130px; height: 18px; border-radius: 6px; }
        .admin-route-loading__user { width: 112px; height: 40px; border-radius: 10px; }
        .admin-route-loading__main { padding: 24px; }
        .admin-route-loading__line--heading { width: 190px; height: 24px; margin-bottom: 20px; border-radius: 7px; }
        .admin-route-loading__cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 18px;
        }
        .admin-route-loading__card { height: 112px; border-radius: 14px; }
        .admin-route-loading__panel { height: 330px; border-radius: 14px; }
        .admin-route-loading__logo::after,
        .admin-route-loading__nav-item::after,
        .admin-route-loading__line::after,
        .admin-route-loading__user::after,
        .admin-route-loading__card::after,
        .admin-route-loading__panel::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.72), transparent);
          animation: admin-loading-shimmer 1.25s infinite;
        }
        @keyframes admin-loading-shimmer { to { transform: translateX(100%); } }
        @media (max-width: 900px) {
          .admin-route-loading__cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .admin-route-loading__sidebar { width: 64px; padding-inline: 10px; }
          .admin-route-loading__logo { width: 38px; }
          .admin-route-loading__page { margin-left: 64px; }
          .admin-route-loading__main { padding: 16px; }
          .admin-route-loading__cards { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .admin-route-loading__logo::after,
          .admin-route-loading__nav-item::after,
          .admin-route-loading__line::after,
          .admin-route-loading__user::after,
          .admin-route-loading__card::after,
          .admin-route-loading__panel::after { animation: none; }
        }
      `}</style>
    </>
  );
}
