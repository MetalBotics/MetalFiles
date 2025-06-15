"use client";

import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
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
                className="text-3xl font-bold text-white group-hover:text-blue-400 transition-colors duration-300 select-none font-orbitron"
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
