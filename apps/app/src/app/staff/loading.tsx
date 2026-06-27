export default function StaffLoading() {
  return (
    <div className="space-y-5">
      {/* page header */}
      <div className="space-y-2">
        <div className="skel h-8 w-48" />
        <div className="skel h-4 w-64" />
      </div>
      {/* stat tiles */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skel h-[6rem] rounded-2xl" />
        ))}
      </div>
      {/* main content */}
      <div className="skel h-64 rounded-2xl" />
      <div className="skel h-48 rounded-2xl" />
    </div>
  );
}
