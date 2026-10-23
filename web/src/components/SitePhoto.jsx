import { credit } from "@/lib/photos";

/**
 * A credited site photo (src/lib/photos.js). Fills its positioned parent; the credit sits on
 * the image and links to the Commons page, as CC BY / BY-SA require.
 */
export function SitePhoto({ photo, sizes = "100vw", priority = false, className = "", showCredit = true }) {
  if (!photo) return null;
  return (
    <>
      <img
        src={photo.src}
        srcSet={`${photo.srcSmall} 800w, ${photo.src} 1600w`}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
      />
      {showCredit && (
        <a
          href={photo.source}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 max-w-[calc(100%-16px)] truncate rounded-[3px] bg-black/55 px-2 py-0.5 text-[11px] text-white/85 hover:text-white"
        >
          {credit(photo)} (resized)
        </a>
      )}
    </>
  );
}
