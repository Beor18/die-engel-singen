import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";

/** The 1200 x 630 preview of the game for WhatsApp, Facebook and X. Built once, at build time. */

const BLACK = "rgb(2,3,5)";
const RED = "rgb(152,18,26)";
const STAR = "M270 -9C269 -2 267 -1 263 0C267 1 269 2 270 9C271 2 273 1 277 0C273 -1 271 -2 270 -9Z";

const font = (file: string) => readFile(path.join(process.cwd(), "src/assets/fuentes", file));
const dataUrl = (buffer: Buffer) => `data:image/jpeg;base64,${buffer.toString("base64")}`;

export async function gameCard(): Promise<Buffer> {
  const art = path.join(process.cwd(), "public/juego/portada.jpg");
  const [background, poster, title, text, italic] = await Promise.all([
    sharp(art).resize(1200, 630, { fit: "cover", position: "centre" }).blur(18).modulate({ brightness: 0.45 }).jpeg({ quality: 70 }).toBuffer(),
    sharp(art).resize(420, 630, { fit: "cover", position: "bottom" }).jpeg({ quality: 86 }).toBuffer(),
    font("LibreCaslonDisplay-Regular.ttf"),
    font("STIXTwoText-Regular.ttf"),
    font("STIXTwoText-Italic.ttf"),
  ]);

  const response = new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: BLACK }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={dataUrl(background)} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }} />
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={dataUrl(poster)} width={420} height={630} style={{ position: "absolute", top: 0, right: 0 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background: "linear-gradient(90deg, rgba(2,3,5,0.92) 0%, rgba(2,3,5,0.8) 52%, rgba(2,3,5,0) 72%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 80,
            width: 700,
            height: 630,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            color: "rgb(247,247,245)",
          }}
        >
          <div style={{ fontFamily: "Text", fontStyle: "italic", fontSize: 32, opacity: 0.8 }}>Un juego dentro de Die Engel Singen</div>
          <div style={{ fontFamily: "Title", fontSize: 150, lineHeight: 1, marginTop: 10 }}>La Voz</div>
          <div style={{ display: "flex", marginTop: 26, marginBottom: 26 }}>
            <svg width={330} height={29} viewBox="160 -9.5 220 19">
              <path d="M160 0H258M282 0H380" stroke={RED} strokeWidth="1.2" fill="none" />
              <path d={STAR} fill={RED} />
            </svg>
          </div>
          <div style={{ fontFamily: "Text", fontSize: 36, lineHeight: 1.3, maxWidth: 620 }}>
            Las sombras se comieron los versos. Rescatalos y devolvele el canto al coro.
          </div>
          <div style={{ fontFamily: "Text", fontStyle: "italic", fontSize: 28, marginTop: 22, opacity: 0.75 }}>Poemas de Fernando López</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Title", data: title, weight: 400, style: "normal" },
        { name: "Text", data: text, weight: 400, style: "normal" },
        { name: "Text", data: italic, weight: 400, style: "italic" },
      ],
    },
  );
  const png = Buffer.from(await response.arrayBuffer());
  return sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}
