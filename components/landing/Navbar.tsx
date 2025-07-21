import Link from "next/link";
import { Button } from "../ui/button";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

const Navbar = () => {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-around px-4">
        <Link className="flex items-center space-x-2 font-bold" href="/">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-800 shadow-md">
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 opacity-50 blur-sm"></div>
          </div>
          <span className="tracking-widest text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-gray-500 to-white">
            NOVA
          </span>
        </Link>
        <div className="flex items-center space-x-4">
          <SignedOut>
            <SignInButton mode="modal">
              <Button className="bg-transparent border border-gray-500 cursor-pointer hover:bg-gray-200/10">
                Login
              </Button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <UserButton />
            <Button className="text-xs cursor-pointer bg-gradient-to-r from-blue-800 to-violet-800 text-white hover:from-blue-600 hover:to-violet-600 transition-all duration-300">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </SignedIn>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
