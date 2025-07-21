import { motion } from "framer-motion"
import { BarChart3, Brain, Database, FileText, Globe, Settings } from "lucide-react"

const Features = () => {
  return (
          <section
        id="features"
        className="relative z-10 border-t border-white/10 bg-black py-24"
      >
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-gray-600 to-white">
              Powerful AI Features
            </h2>
            <p className="mt-4 text-gray-400 text-lg">
              Transform your data into actionable insights
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-400/20 hover:bg-white/10"
            >
              <FileText className="mb-4 h-12 w-12 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="mb-2 text-xl font-bold">PDF Intelligence</h3>
              <p className="text-gray-400 leading-relaxed">
                Upload any PDF document and chat with it naturally. Extract key
                information and get instant answers.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-400/20 hover:bg-white/10"
            >
              <BarChart3 className="mb-4 h-12 w-12 text-violet-400 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="mb-2 text-xl font-bold">CSV Analytics</h3>
              <p className="text-gray-400 leading-relaxed">
                Upload CSV files and analyze business trends with AI-generated
                graphs and comprehensive insights.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-400/20 hover:bg-white/10"
            >
              <Globe className="mb-4 h-12 w-12 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="mb-2 text-xl font-bold">Web Scraping</h3>
              <p className="text-gray-400 leading-relaxed">
                Paste any URL and let our AI agent scrape and analyze the
                content for comprehensive insights.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-400/20 hover:bg-white/10"
            >
              <Database className="mb-4 h-12 w-12 text-violet-400 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="mb-2 text-xl font-bold">
                Multi-Source Integration
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Ingest data from multiple sources simultaneously for
                comprehensive analysis and insights.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-400/20 hover:bg-white/10"
            >
              <Settings className="mb-4 h-12 w-12 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="mb-2 text-xl font-bold">AI Configuration</h3>
              <p className="text-gray-400 leading-relaxed">
                Fine-tune AI models, adjust temperature settings, and configure
                tokens for optimal performance.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              viewport={{ once: true }}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-400/20 hover:bg-white/10"
            >
              <Brain className="mb-4 h-12 w-12 text-violet-400 group-hover:scale-110 transition-transform duration-300" />
              <h3 className="mb-2 text-xl font-bold">Neural Processing</h3>
              <p className="text-gray-400 leading-relaxed">
                Advanced neural networks process your data with human-like
                understanding and contextual responses.
              </p>
            </motion.div>
          </div>
        </div>
      </section>
  )
}

export default Features
