import Image from "next/image";

export default function Loading() {
  return (
    <div className="sbs-global-loading">
      <div className="sbs-loading-logo">
        <Image
          src="/sbs-logo-black.png"
          alt="Sharif Business Solutions"
          width={180}
          height={70}
          priority
        />

        <div className="sbs-logo-wave" />
        <div className="sbs-logo-shine" />
      </div>
    </div>
  );
}