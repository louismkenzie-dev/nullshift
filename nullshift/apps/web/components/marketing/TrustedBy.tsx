import Image from "next/image";
import { LogoMarquee } from "./LogoMarquee";
import styles from "./TrustedBy.module.css";

const CLIENTS = [
  { name: "LTA", src: "/clients/lta-logo.svg", width: 210, height: 127, kind: "lta" },
  {
    name: "The Dance Exclusive",
    src: "/clients/the-dance-exclusive-wordmark.svg",
    width: 849,
    height: 398,
    kind: "dance",
  },
  {
    name: "New Future Therapy",
    src: "/clients/newfuture-therapy-leaf.svg",
    width: 180,
    height: 216,
    kind: "leaf",
  },
  {
    name: "School’s Out Activities",
    src: "/clients/schools-out-splat-transparent.png",
    width: 1254,
    height: 1254,
    kind: "splat",
  },
  // Owner-supplied Shegisha wordmark: preserve the lettering without shipping a font.
  {
    name: "WeHost",
    src: "/clients/wehost-wordmark.png",
    width: 548,
    height: 164,
    kind: "wehost",
  },
] as const;

export function TrustedBy() {
  return (
    <LogoMarquee>
      <ul className={styles.accessible}>
        {CLIENTS.map((client) => (
          <li key={client.name}>{client.name}</li>
        ))}
      </ul>
      <div className={styles.viewport} aria-hidden="true">
        <div className={styles.track} data-logo-track>
          {[0, 1].map((copy) => (
            <div className={styles.group} data-logo-group key={copy}>
              {CLIENTS.map((client) => (
                <div className={styles.logo} data-kind={client.kind} key={client.name}>
                  <Image
                    src={client.src}
                    alt=""
                    width={client.width}
                    height={client.height}
                    sizes={
                      client.kind === "wehost"
                        ? "300px"
                        : client.kind === "leaf"
                          ? "66px"
                          : client.kind === "lta"
                            ? "96px"
                            : client.kind === "splat"
                              ? "84px"
                              : "164px"
                    }
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </LogoMarquee>
  );
}
