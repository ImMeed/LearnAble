export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const actionBase =
  "inline-flex shrink-0 whitespace-nowrap !min-h-11 items-center justify-center !rounded-[1rem] !border !px-4 !py-2.5 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none";

export function actionClass(variant: "primary" | "secondary" | "soft" | "ghost" | "light" = "primary") {
  switch (variant) {
    case "secondary":
      return `${actionBase} !border-secondary !bg-secondary !text-secondary-foreground hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(111,207,151,0.25)]`;
    case "soft":
      return `${actionBase} !border-border !bg-background !text-foreground hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(33,40,55,0.08)]`;
    case "ghost":
      return "inline-flex shrink-0 whitespace-nowrap !min-h-11 items-center !rounded-[1rem] !border !border-transparent !bg-transparent !px-4 !py-2 text-sm font-medium !text-muted-foreground transition duration-200 ease-out hover:!border-border hover:!bg-background hover:!text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
    case "light":
      return `${actionBase} !border-transparent !bg-white !text-primary hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(255,255,255,0.24)]`;
    default:
      return `${actionBase} !border-primary !bg-primary !text-primary-foreground hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(74,144,226,0.24)]`;
  }
}

export const inputClass =
  "!min-h-12 w-full !rounded-[1rem] !border !border-border !bg-background !px-4 text-sm !text-foreground placeholder:text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary";

export const pageShellClass = "min-h-screen bg-background text-foreground";

export const sectionFrameClass = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export const sectionTitleClass =
  "text-center text-[clamp(1.8rem,2.6vw,2.7rem)] font-semibold tracking-[-0.03em] text-foreground";

export const surfaceClass = "rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-soft)]";
