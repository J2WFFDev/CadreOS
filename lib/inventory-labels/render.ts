import bwipjs from "bwip-js";
import QRCode from "qrcode";

import type { InventoryLabelSymbol, LabelRenderContext } from "./types";

export type RenderedLabelSymbol = InventoryLabelSymbol & {
  dataUri: string;
};

function svgToDataUri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function renderQrDataUri(value: string) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    width: 256,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  });

  return svgToDataUri(svg);
}

function renderCode128DataUri(value: string) {
  const svg = bwipjs.toSVG({
    bcid: "code128",
    text: value,
    scale: 2,
    height: 12,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });

  return svgToDataUri(svg);
}

export async function renderLabelSymbols(symbols: InventoryLabelSymbol[]): Promise<RenderedLabelSymbol[]> {
  return Promise.all(
    symbols.map(async (symbol) => ({
      ...symbol,
      dataUri: symbol.kind === "QR" ? await renderQrDataUri(symbol.value) : renderCode128DataUri(symbol.value),
    })),
  );
}

export async function renderInventoryLabelAssets(context: LabelRenderContext) {
  return {
    symbols: await renderLabelSymbols(context.symbols),
  };
}
