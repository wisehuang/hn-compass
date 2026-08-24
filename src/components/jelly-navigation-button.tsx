"use client";

type JellyNavigationButtonProps = {
  href: string;
  children: string;
  newTab?: boolean;
  variant?: "amber" | "azure" | "mint" | "platinum";
};

export function JellyNavigationButton({ children, href, newTab = false, variant = "platinum" }: JellyNavigationButtonProps) {
  const label = newTab ? `${children}（在新分頁開啟）` : children;

  function navigate() {
    if (newTab) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.assign(href);
  }

  return <jelly-button aria-label={label} onClick={navigate} shape="square" size="small" type="button" variant={variant}>{children}</jelly-button>;
}
