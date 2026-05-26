declare module "bwip-js" {
  const bwipjs: {
    toSVG(options: Record<string, unknown>): string;
  };

  export default bwipjs;
}

declare module "qrcode" {
  export type QRCodeToStringOptions = {
    type?: "svg" | string;
    margin?: number;
    width?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    color?: {
      dark?: string;
      light?: string;
    };
  };

  const QRCode: {
    toString(text: string, options?: QRCodeToStringOptions): Promise<string>;
  };

  export default QRCode;
}
