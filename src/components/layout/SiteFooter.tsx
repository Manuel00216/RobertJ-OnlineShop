import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
        <p>
          Questions?{" "}
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {siteConfig.supportEmail}
          </a>
        </p>
      </div>
    </footer>
  );
}
