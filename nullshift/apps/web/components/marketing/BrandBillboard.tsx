import { getImageProps } from "next/image";
import styles from "./BrandBillboard.module.css";

const { props: imageProps } = getImageProps({
  src: "/media/brand/nullshift-billboard-1600.webp",
  alt: "An illuminated emerald Nullshift billboard in a dark station, with the words Agentic AI, Automation, Systems.",
  width: 1600,
  height: 1200,
  loading: "lazy",
  decoding: "async",
  // These responsive files are already optimized; avoid another encoding pass.
  unoptimized: true,
});

export function BrandBillboard() {
  return (
    <figure id="brand-billboard" className={styles.billboard}>
      {/* Server-rendered image props keep this static visual free of client JS. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...imageProps}
        alt={imageProps.alt}
        className={styles.image}
        srcSet="/media/brand/nullshift-billboard-800.webp 800w, /media/brand/nullshift-billboard-1600.webp 1600w, /media/brand/nullshift-billboard-2400.webp 2400w"
        sizes="100vw"
      />
    </figure>
  );
}
