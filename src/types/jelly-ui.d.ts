import type React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "jelly-theme": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { mode?: "auto" | "light" | "dark" };
      "jelly-badge": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { variant?: string; size?: string; outline?: boolean };
    }
  }
}
