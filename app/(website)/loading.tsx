export default function Loading() {
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "3px solid #f3e6d6",
          borderTopColor: "#e67e22",
          animation: "damru-loading-spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes damru-loading-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
