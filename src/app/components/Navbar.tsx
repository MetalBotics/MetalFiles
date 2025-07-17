"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="w-full bg-black/80 backdrop-blur-md border-b border-white/30 shadow-lg relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            {" "}
            <Link
              href="/"
              className="group cursor-pointer flex items-center gap-4"
            >
              <div className="w-10 h-10 flex items-center justify-center favicon-container">
                <img
                  src="/favicon.ico"
                  alt="MetalFiles Icon"
                  width="40"
                  height="40"
                  className="group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    console.log("Favicon failed to load");
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
              <h1 className="text-3xl font-bold text-white group-hover:text-blue-400 transition-colors duration-300 select-none logo-text">
                MetalFiles
              </h1>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
