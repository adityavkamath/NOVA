import Link from "next/link";

const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-black py-8">
      <div className="container mx-auto flex flex-col items-center justify-around space-y-4 px-4 md:flex-row md:space-y-0">
        <div className="flex items-center space-x-2">
          <Link className="flex items-center space-x-2 font-bold" href="/">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-800 shadow-md">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 opacity-50 blur-sm"></div>
            </div>
            <span className="tracking-widest text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-gray-500 to-white">
              NOVA
            </span>
          </Link>
        </div>
        <p className="text-sm text-gray-400">
          © {new Date().getFullYear()} NOVA. All rights reserved.
        </p>
        <div className="flex space-x-6">
          <Link
            className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
            href="#"
          >
            Privacy
          </Link>
          <Link
            className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
            href="#"
          >
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
