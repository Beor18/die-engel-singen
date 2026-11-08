import { gameCard } from "@/game/card";

export const dynamic = "force-static";

/** Preview image of the game, 1200 x 630, for social networks. */
export async function GET() {
  const image = await gameCard();
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(image.length),
      "Cache-Control": "public, max-age=86400, s-maxage=31536000",
    },
  });
}
