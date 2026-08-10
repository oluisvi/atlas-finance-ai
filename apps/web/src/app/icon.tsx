import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = { width: 512, height: 512 };

export default function Icon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#062d31" }}><div style={{ width: 196, height: 236, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(45deg)", borderRadius: 42, background: "linear-gradient(135deg,#25b88b,#087a5b)" }}><div style={{ width: 8, height: 285, background: "#b5ead8", opacity: .75, transform: "rotate(-18deg)" }} /></div></div>, size);
}
