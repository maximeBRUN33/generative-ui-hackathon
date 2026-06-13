import { redirect } from "next/navigation";

/* The entry point is the Pixel Campus drop-zone landing, which lives on the
 * /fixed workspace route (it needs the agent + surface pipeline mounted). The
 * old marketing landing is preserved at /overview. */
export default function Home() {
  redirect("/fixed");
}
