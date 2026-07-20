// Free-licensed Unsplash photography (docs/16 §11 — real photography, not
// AI-generated). Each entry verified reachable and visually matched to its
// use before being wired in. Treatment is unified at render time by the
// <TreatedImage> component (globals.css .photo-treated), per docs/18 §2 —
// this is what makes photographs pulled from a dozen different sources
// read as one hotel's house look.

function unsplash(id: string, w: number, q = 80) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;
}

export function unsplashSrc(id: string, w: number) {
  return unsplash(id, w);
}

// Every ID below was re-verified individually (one image, one Read call) after
// a batch mis-attribution slipped three wrong photos past the first review —
// a lecture hall, a camera product shot, and a misty countryside field had
// been wired in under ocean/room/terrace labels. Do not re-batch these checks.
export const IMG = {
  heroMorning: "1520942702018-0862200e6873",
  heroDusk: "1414609245224-afa02bfb3fda",
  introCove: "1471922694854-ff1b63b20054",
  // 1602002418082 (a Maldives overwater villa) was cut from Ocean View Suite —
  // its thatch and stilt architecture read as tropical-resort, not "Bellevue
  // Cove since 1968." Replaced with a warmer, region-neutral room instead.
  roomOceanView: "1618773928121-c32242e63f39",
  roomGarden: "1512918728675-ed5a9ecdebfd",
  roomPresidential: "1590490360182-c33d57733427",
  roomFamily: "1618221469555-7f3ad97540d6",
  diningRooftop: "1571003123894-1f0594d2b5d9",
  diningPalmTerrace: "1550966871-3ed3cdb5ed0c",
  spaTreatment: "1544161515-4ab6ce6db874",
  expSailing: "1439405326854-014607f694d7",
  expCabana: "1519046904884-53103b34b206",
  expKidsClub: "1540541338287-41700207dee6",
  galleryPool: "1571896349842-33c89424de2d",
  galleryBrass: "1540932239986-30128078f3c5",
  galleryStone: "1571501679680-de32f1e7aad4",
  galleryQuiet: "1544716278-ca5e3f4abd8c",
  locationAerial: "1518623489648-a173ef7824f3",
  weddingPavilion: "1502635385003-ee1e6a1a742d",
  weddingTerrace: "1533105079780-92b9be482077",
} as const;
