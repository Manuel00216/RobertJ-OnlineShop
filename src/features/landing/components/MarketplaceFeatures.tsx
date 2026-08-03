import { Layers, ShieldCheck, Truck, Zap } from "lucide-react";

import { Reveal } from "@/features/landing/components/Reveal";
import type { MarketplaceFeature } from "@/features/landing/types/landing.types";

const ICON_CLASS = "h-[22px] w-[22px]";

const FEATURES: MarketplaceFeature[] = [
  {
    icon: <Layers className={ICON_CLASS} aria-hidden="true" />,
    title: "Curated Multi-Shop Catalog",
    description:
      "Hundreds of verified independent fashion shops, quality-checked and unified in one experience.",
  },
  {
    icon: <ShieldCheck className={ICON_CLASS} aria-hidden="true" />,
    title: "Secure & Trusted Checkout",
    description:
      "Encrypted payments, buyer protection, and a straightforward return policy across all shops.",
  },
  {
    icon: <Zap className={ICON_CLASS} aria-hidden="true" />,
    title: "Smart Shopping Assistant",
    description:
      "Our AI finds the right fit, style, and price across every shop in seconds.",
  },
  {
    icon: <Truck className={ICON_CLASS} aria-hidden="true" />,
    title: "One Cart, One Shipment",
    description:
      "Order from multiple shops and receive a single consolidated delivery to your door.",
  },
];

/** "Why RobertJ" value-proposition cards. */
export function MarketplaceFeatures() {
  return (
    <section className="bg-rj-white py-24">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal className="mb-16 text-center">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red">
            Why RobertJ
          </p>
          <h2 className="font-serif text-4xl leading-[1.05] text-rj-black md:text-[52px]">
            Built for Smarter Shopping
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delayMs={i * 100}>
              <article className="group h-full rounded-2xl bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-rj-black text-rj-white transition-colors duration-300 group-hover:bg-rj-red">
                  {feature.icon}
                </div>
                <h3 className="mb-2.5 text-[15px] font-semibold leading-snug text-rj-black">
                  {feature.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-rj-gray-400">
                  {feature.description}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
