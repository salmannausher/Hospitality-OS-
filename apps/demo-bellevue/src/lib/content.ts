// Property facts sourced verbatim from docs/16-demo-property-content.md —
// nothing here is invented. Testimonial copy is flagged as authored-for-demo
// in docs/19 §8 (content gap): fictional guests, written to brand voice.

export const PROPERTY = {
  name: "Bellevue Hotel",
  starRating: 5,
  checkInTime: "3:00 PM",
  checkOutTime: "11:00 AM",
  location: "Oceanfront, Bellevue Cove",
  airportNote: "25 minutes from Bellevue Regional Airport",
  brandStory:
    "Since 1968, Bellevue Hotel has stood at the edge of Bellevue Cove as the coastline's quiet constant — a five-star retreat built around unhurried service and a view that hasn't needed to change in fifty years.",
} as const;

export const ROOMS = [
  {
    slug: "ocean-view-suite",
    name: "Ocean View Suite",
    view: "Ocean, private balcony",
    capacity: "2–3 guests",
    beds: "1 king + daybed",
    rate: "$750–950",
    accessible: false,
    feeling:
      "A private balcony held over the water — the room the view was built for.",
    image: "roomOceanView",
  },
  {
    slug: "presidential-suite",
    name: "Presidential Suite",
    view: "Full ocean, corner",
    capacity: "4 guests",
    beds: "1 king + living area",
    rate: "$1,800–2,400",
    accessible: false,
    feeling:
      "The corner suite, full ocean on two sides — a residence, not a room.",
    image: "roomPresidential",
  },
  {
    slug: "garden-room",
    name: "Garden Room",
    view: "Garden",
    capacity: "2 guests",
    beds: "1 king or 2 twin",
    rate: "$450–550",
    accessible: false,
    feeling: "Quiet and unhurried, a few steps from everything.",
    image: "roomGarden",
  },
  {
    slug: "garden-room-accessible",
    name: "Garden Room, Accessible",
    view: "Garden",
    capacity: "2 guests",
    beds: "1 king, roll-in shower",
    rate: "$450–550",
    accessible: true,
    feeling: "The same quiet garden room, fully accessible throughout.",
    image: "roomGarden",
  },
  {
    slug: "family-suite",
    name: "Family Suite",
    view: "Garden",
    capacity: "4–5 guests",
    beds: "2 queen + sofa bed, connects to Garden Room",
    rate: "$650–800",
    accessible: false,
    feeling: "Room enough for the whole family, still unmistakably Bellevue.",
    image: "roomFamily",
  },
] as const;

export const DINING = [
  {
    name: "The Rooftop at Bellevue",
    cuisine: "Coastal Mediterranean",
    hours: "Dinner only, 6–10 PM",
    dress: "Smart casual",
    note: "Reservations recommended. Vegetarian, vegan, and gluten-free available on request.",
    image: "diningRooftop",
  },
  {
    name: "Palm Terrace",
    cuisine: "All-day dining",
    hours: "Breakfast 7–10:30 AM, lunch, dinner",
    dress: "Casual",
    note: "Family-friendly, with a dedicated kids' menu.",
    image: "diningPalmTerrace",
  },
] as const;

export const SPA_TREATMENTS = [
  { name: "Deep Tissue Massage", duration: "60 / 90 min", price: "$180 / $240" },
  { name: "Couples Massage", duration: "60 min", price: "$420 (pair)" },
  {
    name: "Prenatal Massage",
    duration: "60 min",
    price: "$190",
    note: "Suitability confirmed with spa staff.",
  },
  { name: "Ocean Facial", duration: "45 min", price: "$150" },
  { name: "Hot Stone Therapy", duration: "75 min", price: "$210" },
] as const;

export const EXPERIENCES = [
  {
    name: "Sunset Sailing Charter",
    category: "Off-site",
    duration: "2 hrs",
    price: "$350/couple",
    leadTime: "24 hrs notice",
    image: "expSailing",
  },
  {
    name: "Private Beach Cabana",
    category: "On-site",
    duration: "Full day",
    price: "$250",
    leadTime: "48 hrs notice",
    image: "expCabana",
  },
  {
    name: "Kids' Club Adventure Day",
    category: "On-site",
    duration: "Half-day",
    price: "$85/child (ages 4–12)",
    leadTime: "Same day",
    image: "expKidsClub",
  },
] as const;

export const LOCAL_RECOMMENDATIONS = [
  {
    name: "Cliffside Coastal Trail",
    category: "Outdoors · 5 min walk",
    note: "The best sunrise view in Bellevue Cove.",
  },
  {
    name: "Harbor Row Sushi",
    category: "Dining · 10 min drive",
    note: "The hotel's own pick for a special dinner out.",
  },
  {
    name: "The Vintage District",
    category: "Shopping · 15 min drive",
    note: "Boutique galleries and wine bars.",
  },
  {
    name: "Marina Farmers Market",
    category: "Saturdays only",
    note: "Guests love the fresh oyster stand.",
  },
] as const;

export const POLICIES = [
  {
    label: "Check-in / check-out",
    detail: "3:00 PM / 11:00 AM. Early check-in subject to availability.",
  },
  {
    label: "Pets",
    detail: "Welcome in select rooms. $75/night fee. Breed restrictions may apply.",
  },
  {
    label: "Cancellation",
    detail: "Free up to 48 hours before arrival; one night charged after that.",
  },
  {
    label: "Parking",
    detail: "Valet $45/night. Self-park $30/night.",
  },
] as const;

export const WEDDING_VENUES = [
  {
    name: "The Grand Pavilion",
    detail: "Oceanfront ballroom, seats 200, full AV. Catering minimum $15,000.",
    image: "weddingPavilion",
  },
  {
    name: "Sunset Terrace",
    detail: "Outdoor ceremony space, capacity 120. Catering minimum $8,000.",
    image: "weddingTerrace",
  },
] as const;

// Authored for this demo, to the brand voice — flagged as a content gap in
// docs/19 §8. Not present in docs/16; write real guest voices before ships.
export const TESTIMONIALS = [
  {
    quote:
      "We married on the Sunset Terrace twelve years ago. This year we came back with our daughter, and the desk still remembered our anniversary before we said a word.",
    attribution: "R. & M., returning guests since 2013",
  },
  {
    quote:
      "I have stayed at a great many hotels for work. Bellevue is the only one I've ever gone back to for pleasure.",
    attribution: "J. T., guest since 2019",
  },
  {
    quote:
      "Our children built the same sandcastle their grandparents did, on the same stretch of beach. That is not something you can manufacture.",
    attribution: "The Alvarez family, guests since 2016",
  },
] as const;
