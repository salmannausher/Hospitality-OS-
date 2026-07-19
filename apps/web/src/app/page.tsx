import { Agencies } from "@/components/landing/Agencies";
import { Closing } from "@/components/landing/Closing";
import { Conversation } from "@/components/landing/Conversation";
import { Difference } from "@/components/landing/Difference";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItBegins } from "@/components/landing/HowItBegins";
import { MotionProvider } from "@/components/landing/MotionProvider";
import { Nav } from "@/components/landing/Nav";
import { Problem } from "@/components/landing/Problem";

export default function Home() {
  return (
    <MotionProvider>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Conversation />
        <Difference />
        <HowItBegins />
        <Agencies />
        <Closing />
      </main>
      <Footer />
    </MotionProvider>
  );
}
