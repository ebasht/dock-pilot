import Image from "next/image";
import { AppVersion } from "@/components/AppVersion";

type Props = {
  showVersion?: boolean;
  /** Nav bar vs login screen */
  size?: "nav" | "auth";
};

export function BrandLogo({ showVersion = false, size = "nav" }: Props) {
  return (
    <span className={`brand-logo brand-logo-${size}`}>
      <Image
        src="/logo.png"
        alt="DockPilot"
        width={162}
        height={108}
        priority
        className="brand-logo-img"
      />
      {showVersion && <AppVersion />}
    </span>
  );
}
