import type React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "jelly-theme": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { mode?: "auto" | "light" | "dark"; accent?: string };
      "jelly-badge": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { variant?: "white" | "rose" | "amber" | "azure" | "mint" | "platinum" | "graphite"; size?: "small" | "medium" | "large"; shape?: "pill" | "square" };
      "jelly-card": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { squish?: boolean };
      "jelly-breadcrumbs": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { size?: "small" | "medium" | "large" };
      "jelly-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { shape?: "pill" | "square"; size?: "small" | "medium" | "large"; type?: "button" | "submit" | "reset"; variant?: "white" | "rose" | "amber" | "azure" | "mint" | "platinum" | "graphite" };
    }
  }
}
