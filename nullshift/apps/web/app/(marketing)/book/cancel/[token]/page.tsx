import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { createServiceClient } from "@nullshift/db";
import { hasSupabaseServerConfig } from "@nullshift/db/env";
import { legalConfig } from "@nullshift/content/legal/config";
import { describeSlot } from "@/lib/booking/emails";
import styles from "../../project.module.css";
import b from "../../booking.module.css";
import { cancelBooking } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Cancel your call | Nullshift",
  robots: { index: false, follow: false },
};

type Row = {
  id: string;
  kind: "client" | "partner";
  name: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

export default async function CancelBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { token } = await params;
  const { state } = await searchParams;
  let booking: Row | null = null;
  if (/^[A-Za-z0-9_-]{20,64}$/.test(token) && hasSupabaseServerConfig()) {
    const { data } = await createServiceClient()
      .from("bookings")
      .select("id,kind,name,starts_at,ends_at,status")
      .eq("cancel_token", token)
      .maybeSingle();
    booking = (data as Row | null) ?? null;
  }
  const rebook = booking?.kind === "partner" ? "/book/partner" : "/book/call";
  const past = booking ? Date.parse(booking.starts_at) < Date.now() : false;
  const contact = legalConfig.contact.general;

  return (
    <>
      <Nav />
      <main className={`k-dark ${styles.page}`}>
        <div className={styles.layout}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Your booking</p>
            <h1>
              Plans change.
              <br />
              <span>No problem.</span>
            </h1>
            <p className={styles.lead}>
              Cancel below and the slot goes straight back into the diary. Want a
              different time instead? Cancel, then pick a new one.
            </p>
          </div>
          <div className={styles.card}>
            {!booking ? (
              <div className={styles.received}>
                <p className={styles.eyebrow}>Not found</p>
                <h2>We couldn’t find that booking.</h2>
                <p>
                  The link may have been copied incompletely. Email{" "}
                  <a href={`mailto:${contact}`}>{contact}</a> and we’ll sort it.
                </p>
              </div>
            ) : booking.status === "cancelled" ? (
              <div className={styles.received}>
                <p className={styles.eyebrow}>Cancelled</p>
                <h2>Your call is cancelled.</h2>
                <p>
                  {state === "cancelled"
                    ? "Done — the slot is free again. "
                    : "This booking was already cancelled. "}
                  Book a new time whenever suits.
                </p>
                <div className={b.links}>
                  <Link href={rebook}>Choose a new time</Link>
                </div>
              </div>
            ) : past || booking.status !== "confirmed" ? (
              <div className={styles.received}>
                <p className={styles.eyebrow}>Past booking</p>
                <h2>This call has already happened.</h2>
                <p>
                  Want to talk again? <Link href={rebook}>Book another time</Link>.
                </p>
              </div>
            ) : (
              <form action={cancelBooking}>
                <input type="hidden" name="token" value={token} />
                <h2>Cancel this call?</h2>
                <div className={b.chosen}>
                  <div>
                    <strong>{describeSlot(booking.starts_at, booking.ends_at)}</strong>
                    <span>
                      {booking.kind === "partner" ? "Partner call" : "Call"} ·{" "}
                      {booking.name}
                    </span>
                  </div>
                </div>
                {state === "error" && (
                  <p className={styles.error}>
                    We couldn’t cancel this just now. Please try again or email{" "}
                    <a href={`mailto:${contact}`}>{contact}</a>.
                  </p>
                )}
                <div className={styles.actions}>
                  <Link className={styles.back} href="/">
                    Keep it
                  </Link>
                  <button type="submit" className={styles.submit}>
                    Cancel the call <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
