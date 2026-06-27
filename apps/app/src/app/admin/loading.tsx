export default function AdminLoading() {
  return (
    <div className="space-y-5">
      {/* page header */}
      <div className="space-y-2">
        <div className="skel h-8 w-56" />
        <div className="skel h-4 w-80" />
      </div>
      {/* kpi tile row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skel h-[7.5rem] rounded-2xl" />
        ))}
      </div>
      {/* main content block */}
      <div className="skel h-72 rounded-2xl" />
      <div className="skel h-48 rounded-2xl" />
    </div>
  );
}
