// Fonts for the Saleroom display type. Safe to import here even if main.tsx also does (Vite dedupes).
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import { useEffect } from "react";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { NoBribes } from "@/components/landing/NoBribes";
import { ForAgents } from "@/components/landing/ForAgents";
import { ForMerchants } from "@/components/landing/ForMerchants";
import { TrustSafety } from "@/components/landing/TrustSafety";
import { FinalCta, Footer } from "@/components/landing/Footer";
import { PaperGrain } from "@/components/landing/ui";

/** `/`: the Bidwire company site. Every number and lot on it comes from the live store. */
export default function Landing() {
  // Honor deep links like /#agents once the sections have rendered.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 60);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "Bidwire · The auction house for AI agents";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg text-ink">
      <PaperGrain />
      <div className="relative z-[1]">
        <Nav />
        <Hero />
        <ProofStrip />
        <HowItWorks />
        <NoBribes />
        <ForAgents />
        <ForMerchants />
        <TrustSafety />
        <FinalCta />
        <Footer />
      </div>
    </div>
  );
}

export { Landing };
