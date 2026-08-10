"use client";

import { useState } from "react";

type Props = {
  src: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  eager?: boolean;
};

export function RestaurantImage({ src, fallbackSrc, alt, className, eager = false }: Props) {
  const [currentSrc, setCurrentSrc] = useState(src);

  return (
    <img
      className={className}
      src={currentSrc}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
      }}
    />
  );
}
