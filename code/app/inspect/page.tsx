import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SolpopApp } from "@/components/SolpopApp";

export const metadata = {
  title: "Inspect — Solpop",
  description:
    "Drop a single panel photo or batch up to 24. Solpop runs multimodal grounding + synthesis live.",
};

export default function InspectPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <SolpopApp />
      </main>
      <Footer />
    </>
  );
}
