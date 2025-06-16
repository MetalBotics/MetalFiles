"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [isMounted, setIsMounted] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Check if font is already loaded
    if (document.fonts.check('700 24px Orbitron')) {
      setFontLoaded(true);
    } else {
      // Wait for font to load
      document.fonts.load('700 24px Orbitron').then(() => {
        setFontLoaded(true);
      }).catch(() => {
        // Fallback after timeout
        setTimeout(() => setFontLoaded(true), 100);
      });
    }
  }, []);

  return (
    <nav className="w-full bg-black/80 backdrop-blur-md border-b border-gray-800/50 shadow-lg relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <Link href="/" className="group cursor-pointer flex items-center gap-4">
              <Image
                src="/favicon.ico"
                alt="MetalFiles Icon"
                width={40}
                height={40}
                className="group-hover:scale-110 transition-transform duration-300"
                priority
                unoptimized
              />              <h1
                className={`text-3xl font-bold text-white group-hover:text-blue-400 transition-all duration-300 select-none logo-text ${
                  fontLoaded ? 'orbitron-loaded' : ''
                }`}
                style={{ 
                  opacity: isMounted ? 1 : 0,
                  transition: 'opacity 0.3s ease-in-out'
                }}
              >
                MetalFiles
              </h1>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
