import type { SVGProps } from 'react'

/** Shared vermilion hazard pictogram: filled triangle with a contrasting ivory exclamation mark. */
export function WarningPictogram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 44" className={className} aria-hidden="true" focusable="false" {...props}>
      <path d="M24 2.5c1.3 0 2.5.7 3.2 1.9l19.6 34.2c1.4 2.5-.4 5.4-3.2 5.4H4.4c-2.8 0-4.6-2.9-3.2-5.4L20.8 4.4c.7-1.2 1.9-1.9 3.2-1.9Z" fill="var(--pictogram-fill, #c9402e)" />
      <rect x="21.4" y="14" width="5.2" height="15.5" rx="1.6" fill="var(--pictogram-mark, #f6efdf)" />
      <circle cx="24" cy="35.4" r="3" fill="var(--pictogram-mark, #f6efdf)" />
    </svg>
  )
}

/** Solid crew pictogram (three figures) for staffing instruments. */
export function CrewPictogram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 34" className={className} aria-hidden="true" focusable="false" {...props}>
      <g fill="currentColor">
        <circle cx="35.5" cy="8.5" r="5.6" opacity=".82" />
        <path d="M27 33v-6.2c0-5.2 3.8-9.2 8.5-9.2s8.5 4 8.5 9.2V33Z" opacity=".82" />
        <circle cx="12.5" cy="8.5" r="5.6" opacity=".82" />
        <path d="M4 33v-6.2C4 21.6 7.8 17.6 12.5 17.6S21 21.6 21 26.8V33Z" opacity=".82" />
        <circle cx="24" cy="7.2" r="6.6" />
        <path d="M13.6 34v-7c0-6 4.6-10.6 10.4-10.6S34.4 21 34.4 27v7Z" />
      </g>
    </svg>
  )
}

/** Solid wrench pictogram for service-state instruments. */
export function WrenchPictogram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden="true" focusable="false" {...props}>
      <path fill="currentColor" d="M41.2 9.6a1 1 0 0 0-1.6-.3l-5.7 5.7-5.4-1.4-1.4-5.4 5.7-5.7a1 1 0 0 0-.3-1.6A12.3 12.3 0 0 0 16 15.7c0 1.5.3 2.9.8 4.2L3.6 33.1a4.6 4.6 0 0 0 0 6.5l.8.8a4.6 4.6 0 0 0 6.5 0l13.2-13.2c1.3.5 2.7.8 4.2.8A12.3 12.3 0 0 0 41.2 9.6ZM7.6 38.4a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
    </svg>
  )
}

/** Solid fire-station pictogram (gable with two apparatus bays) for station-network instruments. */
export function StationPictogram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 42" className={className} aria-hidden="true" focusable="false" {...props}>
      <path fill="currentColor" d="M24 1 1 17.5l2.6 3.6L6 19.4V41h36V19.4l2.4 1.7 2.6-3.6L24 1Zm-3 13h6v6h-6v-6ZM10 26h11v15H10V26Zm17 0h11v15H27V26Z" />
      <path fill="var(--pictogram-mark, #ece8d5)" d="M12 29h7v1.6h-7zm0 4h7v1.6h-7zm17-4h7v1.6h-7zm0 4h7v1.6h-7z" />
    </svg>
  )
}
