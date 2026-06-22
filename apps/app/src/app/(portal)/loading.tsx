export default function PortalLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="skel h-8 w-48" />
        <div className="skel h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skel h-[8.75rem] rounded-2xl" />)}
      </div>
      <div className="skel h-80 rounded-2xl" />
    </div>
  );
}
