import { Hero } from "@/components/sections/Hero";
import { Introduction } from "@/components/sections/Introduction";
import { Rooms } from "@/components/sections/Rooms";
import { Dining } from "@/components/sections/Dining";
import { Spa } from "@/components/sections/Spa";
import { Experiences } from "@/components/sections/Experiences";
import { Gallery } from "@/components/sections/Gallery";
import { Testimonials } from "@/components/sections/Testimonials";
import { Location } from "@/components/sections/Location";
import { PracticalNotes } from "@/components/sections/PracticalNotes";
import { BookingInvitation } from "@/components/sections/BookingInvitation";

export default function Home() {
  return (
    <>
      <Hero />
      <Introduction />
      <Rooms />
      <Dining />
      <Spa />
      <Experiences />
      <Gallery />
      <Testimonials />
      <Location />
      <PracticalNotes />
      <BookingInvitation />
    </>
  );
}
