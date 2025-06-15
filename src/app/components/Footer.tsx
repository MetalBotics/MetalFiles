import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-black border-t border-gray-800 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {" "}
        <div className="text-center">
          <h3
            className="text-2xl font-bold orbitron text-white mb-4"
            style={{ fontFamily: '"Orbitron", sans-serif' }}
          >
            MetalBotics
          </h3>
          <p className="roboto-light text-gray-400 mb-8">
            Building the future of enterprise technology <br />
            &copy; {currentYear} MetalBotics. All rights reserved.
          </p>{" "}
          <div className="flex justify-center space-x-8">
            <Link
              href="https://metalbotics.tech/about"
              className="roboto-light text-gray-400 hover:text-white transition-colors duration-200"
            >
              About
            </Link>
            <Link
              href="https://metalbotics.tech/services"
              className="roboto-light text-gray-400 hover:text-white transition-colors duration-200"
            >
              Services
            </Link>
            <Link
              href="https://metalbotics.tech/projects"
              className="roboto-light text-gray-400 hover:text-white transition-colors duration-200"
            >
              Projects
            </Link>
            <Link
              href="https://metalbotics.tech/contact"
              className="roboto-light text-gray-400 hover:text-white transition-colors duration-200"
            >
              Contact
            </Link>
            <Link
              href="https://metalbotics.tech/privacy"
              className="roboto-light text-gray-400 hover:text-white transition-colors duration-200"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
