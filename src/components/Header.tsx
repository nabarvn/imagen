import Link from "next/link";
import Image from "next/image";
import { StarIcon } from "@heroicons/react/24/outline";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Left - Logo and Branding */}
          <div className="flex min-w-0 flex-1 items-center md:space-x-3">
            <div className="relative hidden flex-shrink-0 md:block">
              <div className="rounded-xl border border-violet-100 bg-violet-50">
                <Image
                  priority
                  src="/logo.png"
                  alt="IMAGEN Logo"
                  height={32}
                  width={32}
                  className="h-10 w-10"
                />
              </div>
            </div>

            <div className="flex h-[50px] min-w-0 flex-col">
              <h1 className="text-xl font-bold tracking-tight text-gray-600 sm:text-2xl">
                IMAGEN
              </h1>

              <p className="text-xs font-medium text-gray-500">
                Powered by <span className="text-violet-600">DALL-E</span>,{" "}
                <span className="text-violet-600">GPT</span> &{" "}
                <span className="text-violet-600">Azure</span>
              </p>
            </div>
          </div>

          {/* Right - Action Buttons */}
          <div className="flex flex-shrink-0 items-center space-x-2">
            <Link
              href="https://gpt.nabarun.app"
              target="_blank"
              className="inline-flex h-[42px] items-center rounded-lg border border-violet-200 bg-violet-50 px-2 py-2 text-sm font-medium text-violet-700 transition-all duration-200 hover:border-violet-300 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 sm:pl-3 sm:pr-4"
            >
              <Image
                priority
                src="/chadgpt.png"
                alt="ChadGPT"
                width={25}
                height={25}
                className="h-7 w-7 sm:mr-1"
              />

              <span className="hidden sm:inline">Try ChadGPT</span>
            </Link>

            <Link
              href="https://git.new/imagen"
              target="_blank"
              className="inline-flex h-[42px] items-center rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 sm:px-4"
            >
              <StarIcon className="h-5 w-5 fill-yellow-300 text-yellow-300 sm:mr-2" />

              <span className="hidden sm:mr-1 sm:inline">Star on</span>
              <span className="hidden font-semibold sm:inline">GitHub</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
