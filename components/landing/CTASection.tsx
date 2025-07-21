import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";

const CTASection = () => {
  return (
    <section className="relative z-10 border-t border-white/10 bg-black py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-950/50 to-violet-950/50 p-8 text-center backdrop-blur-sm md:p-12 lg:p-16 shadow-2xl hover:shadow-cyan-400/10 transition-all duration-300">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
            Ready to Get Started?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-400 text-lg leading-relaxed">
            Join thousands of professionals who trust NOVA for intelligent data
            analysis and insights.
          </p>
          <ul className="mx-auto mt-8 flex max-w-2xl flex-col gap-4 text-left">
            <li className="flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0" />
              <span>Process unlimited documents</span>
            </li>
            <li className="flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0" />
              <span>Real-time data visualization</span>
            </li>
            <li className="flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-cyan-400 flex-shrink-0" />
              <span>Enterprise-grade security</span>
            </li>
          </ul>
          <Button
            size="lg"
            className="mt-8 cursor-pointer bg-gradient-to-r from-gray-400 to-gray-200 font-semibold text-lg text-black hover:scale-105"
          >
            Start Free Trial
            <div className="bg-black p-1 flex justify-center items-center rounded-full ml-2">
              <ArrowRight className="text-white h-5 w-5" />
            </div>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
