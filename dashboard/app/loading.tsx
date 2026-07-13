export default function Loading() {
  return (
    <div className="ops-page" aria-busy="true" aria-label="Loading workspace">
      <div className="ops-shell space-y-5">
        <div className="skeleton-card h-28 rounded-[24px]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton-card h-28 rounded-[20px]" />)}
        </div>
        <div className="skeleton-card h-80 rounded-[24px]" />
      </div>
    </div>
  )
}
